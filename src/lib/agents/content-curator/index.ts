import { logger } from '@/lib/logger';
import { db } from '@/db';
import { topics, trends, contentIdeas, users } from '@/db/schema';
import { eq, and, inArray, desc, gte } from 'drizzle-orm';
import { getUserApiKeys } from '@/lib/services/api-keys';
import { generateIdeasForTrend } from './generator';
import { scoreAndPrioritiseIdeas } from './prioritiser';
import { getUserIdeaFeedback, buildFeedbackContext } from '@/lib/services/idea-feedback';
import type { CurationResult, StyleProfileInput } from './types';

const curatorLogger = logger.child({ module: 'content-curator' });

const MAX_TRENDS_TO_PROCESS = 10;
const MIN_VIRALITY_FOR_IDEA_GENERATION = 20;

/**
 * Main curation orchestrator.
 * Takes top trends for a topic (from the latest scan) and generates prioritised content ideas.
 * Optionally auto-approves ideas above the topic's configured threshold.
 */
export async function runContentCuration(
  topicId: string,
  userId: string,
  trendIds: string[]
): Promise<CurationResult> {
  const jobLogger = curatorLogger.child({ topicId, userId, trendCount: trendIds.length });
  const start = Date.now();

  jobLogger.info('Content curation started');

  // Load topic, user style profile, API keys, and idea feedback in parallel
  const [topic, user, userKeys, ideaFeedback] = await Promise.all([
    db.query.topics.findFirst({
      where: and(eq(topics.id, topicId), eq(topics.userId, userId)),
    }),
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { styleProfile: true },
    }),
    getUserApiKeys(userId, ['anthropic']),
    getUserIdeaFeedback(userId),
  ]);

  if (!topic) {
    throw new Error(`Topic ${topicId} not found for user ${userId}`);
  }

  const anthropicKey = userKeys.anthropic ?? null;
  if (!anthropicKey) {
    jobLogger.warn('No Anthropic API key configured - idea generation skipped');
    return { ideasGenerated: 0, ideasSaved: 0, ideasAutoApproved: 0 };
  }

  // Extract style profile from user record
  const styleProfile: StyleProfileInput = buildStyleProfile(user?.styleProfile);

  // Build feedback context string for Claude (null if user has no feedback history yet)
  const feedbackContext = buildFeedbackContext(ideaFeedback);

  // Load the top trends from the provided IDs (sorted by virality, capped)
  const trendData =
    trendIds.length > 0
      ? await db
          .select({
            id: trends.id,
            title: trends.title,
            description: trends.description,
            sourceUrl: trends.sourceUrl,
            platform: trends.platform,
            viralityScore: trends.viralityScore,
            discoveredAt: trends.discoveredAt,
          })
          .from(trends)
          .where(and(inArray(trends.id, trendIds), eq(trends.topicId, topicId)))
          .orderBy(desc(trends.viralityScore))
          .limit(MAX_TRENDS_TO_PROCESS)
      : [];

  const eligibleTrends = trendData.filter(
    (t) => t.viralityScore >= MIN_VIRALITY_FOR_IDEA_GENERATION
  );

  if (eligibleTrends.length === 0) {
    jobLogger.info(
      { minScore: MIN_VIRALITY_FOR_IDEA_GENERATION },
      'No trends meet minimum virality threshold for idea generation'
    );
    return { ideasGenerated: 0, ideasSaved: 0, ideasAutoApproved: 0 };
  }

  jobLogger.info({ eligibleTrends: eligibleTrends.length }, 'Generating ideas for top trends');

  // Load existing idea titles for this topic to deduplicate before inserting
  const existingIdeaTitles = await db
    .select({ title: contentIdeas.title, platform: contentIdeas.platform })
    .from(contentIdeas)
    .where(eq(contentIdeas.topicId, topicId));

  const existingIdeaKeys = new Set<string>(
    existingIdeaTitles.map((i) =>
      `${i.platform}::${i.title.toLowerCase().replace(/\s+/g, ' ').trim()}`
    )
  );

  jobLogger.debug({ existingIdeasCount: existingIdeaTitles.length }, 'Loaded existing idea keys for deduplication');

  // Settings from topic
  const topicSettings = (topic.settings ?? {}) as Record<string, unknown>;
  const autoApproveThreshold =
    typeof topicSettings.autoApproveThreshold === 'number'
      ? topicSettings.autoApproveThreshold
      : null;
  const maxIdeasPerRun =
    typeof topicSettings.maxIdeasPerRun === 'number' ? topicSettings.maxIdeasPerRun : null;

  let ideasGenerated = 0;
  let ideasSaved = 0;
  let ideasAutoApproved = 0;

  // Process trends sequentially to avoid hammering Claude
  for (const trend of eligibleTrends) {
    // Respect per-run cap
    if (maxIdeasPerRun !== null && ideasSaved >= maxIdeasPerRun) {
      jobLogger.info({ maxIdeasPerRun, ideasSaved }, 'Max ideas per run reached, stopping early');
      break;
    }

    try {
      jobLogger.debug({ trendId: trend.id, trendTitle: trend.title }, 'Generating ideas for trend');

      const rawIdeas = await generateIdeasForTrend(
        trend,
        topic.name,
        topic.description ?? null,
        styleProfile,
        anthropicKey,
        feedbackContext
      );

      ideasGenerated += rawIdeas.length;

      if (rawIdeas.length === 0) {
        jobLogger.warn({ trendId: trend.id }, 'No ideas generated for trend');
        continue;
      }

      // Score and prioritise
      const scoredIdeas = await scoreAndPrioritiseIdeas(
        rawIdeas,
        trend,
        topic.name,
        styleProfile,
        anthropicKey
      );

      // Deduplicate: skip ideas whose platform+title already exist for this topic
      const novelIdeas = scoredIdeas.filter((idea) => {
        const key = `${idea.platform}::${idea.title.toLowerCase().replace(/\s+/g, ' ').trim()}`;
        if (existingIdeaKeys.has(key)) return false;
        // Add to the set immediately so duplicates within this run are also caught
        existingIdeaKeys.add(key);
        return true;
      });

      if (novelIdeas.length < scoredIdeas.length) {
        jobLogger.debug(
          { skipped: scoredIdeas.length - novelIdeas.length, trendId: trend.id },
          'Skipped duplicate content ideas'
        );
      }

      // Persist to database
      if (novelIdeas.length > 0) {
        const now = new Date();

        // Clamp to the remaining budget if maxIdeasPerRun is set
        const budget =
          maxIdeasPerRun !== null ? maxIdeasPerRun - ideasSaved : novelIdeas.length;
        const ideasToInsert = novelIdeas.slice(0, budget);

        const inserted = await db
          .insert(contentIdeas)
          .values(
            ideasToInsert.map((idea) => ({
              topicId,
              trendId: trend.id,
              userId,
              title: idea.title,
              description: idea.description,
              platform: idea.platform,
              contentType: idea.contentType,
              suggestedCopy: idea.suggestedCopy,
              visualDirection: idea.visualDirection,
              priorityScore: idea.priorityScore,
              status:
                autoApproveThreshold !== null && idea.priorityScore >= autoApproveThreshold
                  ? ('approved' as const)
                  : ('suggested' as const),
              createdAt: now,
              updatedAt: now,
            }))
          )
          .returning({ id: contentIdeas.id, status: contentIdeas.status });

        ideasSaved += inserted.length;
        ideasAutoApproved += inserted.filter((i) => i.status === 'approved').length;
      }
    } catch (err) {
      jobLogger.error({ err, trendId: trend.id }, 'Failed to generate ideas for trend, continuing');
      // Graceful degradation: continue with remaining trends
    }
  }

  const duration = Date.now() - start;

  jobLogger.info(
    { ideasGenerated, ideasSaved, ideasAutoApproved, duration },
    'Content curation completed'
  );

  return { ideasGenerated, ideasSaved, ideasAutoApproved };
}

/**
 * Build a StyleProfileInput from the user's stored style profile JSON.
 * Falls back to sensible defaults if the profile is missing or incomplete.
 */
function buildStyleProfile(raw: unknown): StyleProfileInput {
  if (raw === null || typeof raw !== 'object') {
    return defaultStyleProfile();
  }

  const p = raw as Record<string, unknown>;

  return {
    tone: typeof p.tone === 'string' ? p.tone : 'professional and engaging',
    voiceCharacteristics: Array.isArray(p.voiceCharacteristics)
      ? (p.voiceCharacteristics as string[])
      : ['clear', 'informative'],
    vocabularyLevel: typeof p.vocabularyLevel === 'string' ? p.vocabularyLevel : 'moderate',
    emojiUsage: typeof p.emojiUsage === 'string' ? p.emojiUsage : 'minimal',
    hashtagStyle: typeof p.hashtagStyle === 'string' ? p.hashtagStyle : 'minimal',
    contentThemes: Array.isArray(p.contentThemes) ? (p.contentThemes as string[]) : [],
    platformPreferences:
      typeof p.platformPreferences === 'object' && p.platformPreferences !== null
        ? (p.platformPreferences as Record<string, string>)
        : {},
    doList: Array.isArray(p.doList) ? (p.doList as string[]) : ['be helpful', 'stay on-brand'],
    dontList: Array.isArray(p.dontList) ? (p.dontList as string[]) : ['be generic'],
  };
}

function defaultStyleProfile(): StyleProfileInput {
  return {
    tone: 'professional and engaging',
    voiceCharacteristics: ['clear', 'informative', 'approachable'],
    vocabularyLevel: 'moderate',
    emojiUsage: 'minimal',
    hashtagStyle: 'minimal',
    contentThemes: [],
    platformPreferences: {},
    doList: ['provide value', 'stay on-topic', 'use a clear CTA'],
    dontList: ['be overly salesy', 'use jargon', 'be generic'],
  };
}

/**
 * Scheduled content curation run (not triggered by a fresh scan).
 * Fetches the top recent high-virality trends from the DB and generates ideas for them.
 * Used by the recurring content generation schedule.
 */
export async function runScheduledContentCuration(
  topicId: string,
  userId: string
): Promise<CurationResult> {
  const jobLogger = curatorLogger.child({ topicId, userId, scheduled: true });
  const start = Date.now();

  jobLogger.info('Scheduled content curation started');

  // Load topic to get deduplication window
  const topic = await db.query.topics.findFirst({
    where: and(eq(topics.id, topicId), eq(topics.userId, userId)),
  });

  if (!topic) {
    throw new Error(`Topic ${topicId} not found for user ${userId}`);
  }

  // Fetch recent high-virality trends within the deduplication window
  const windowHours = topic.trendDeduplicationWindowHours ?? 24;
  const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  const recentTrendIds = await db
    .select({ id: trends.id })
    .from(trends)
    .where(
      and(
        eq(trends.topicId, topicId),
        gte(trends.discoveredAt, windowStart)
      )
    )
    .orderBy(desc(trends.viralityScore))
    .limit(MAX_TRENDS_TO_PROCESS);

  if (recentTrendIds.length === 0) {
    jobLogger.info({ windowHours }, 'No recent trends found within deduplication window');
    return { ideasGenerated: 0, ideasSaved: 0, ideasAutoApproved: 0 };
  }

  const trendIds = recentTrendIds.map((t) => t.id);
  jobLogger.info({ trendCount: trendIds.length, windowHours }, 'Found recent trends, running curation');

  const result = await runContentCuration(topicId, userId, trendIds);

  const duration = Date.now() - start;
  jobLogger.info({ ...result, duration }, 'Scheduled content curation completed');

  return result;
}
