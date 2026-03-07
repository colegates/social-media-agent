import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';
import { getPlatformFitScore } from './generator';
import type { GeneratedIdea, ScoredIdea, TrendInput, StyleProfileInput } from './types';

const prioritiserLogger = logger.child({ module: 'content-curator/prioritiser' });

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

/**
 * Priority score formula:
 * score = (viralityScore * 0.35) + (brandRelevance * 0.35) + (platformFit * 0.15) + (timeliness * 0.15)
 *
 * - viralityScore: from trend (0-100), normalised
 * - brandRelevance: Claude assesses how well the idea fits the user's brand (0-100)
 * - platformFit: predefined scoring based on content type + platform match (0-100)
 * - timeliness: bonus for trends peaking right now (0-100, decays with age)
 */

function calculateTimeliness(discoveredAt: Date): number {
  const ageMs = Date.now() - discoveredAt.getTime();
  const ageHours = ageMs / (1000 * 60 * 60);

  // Full score for trends < 6 hours old, decays linearly to 0 at 72 hours
  if (ageHours <= 6) return 100;
  if (ageHours >= 72) return 0;
  return Math.round(100 * (1 - (ageHours - 6) / (72 - 6)));
}

/**
 * Uses Claude to batch-assess brand relevance for multiple ideas at once.
 * Returns a map of idea index → relevance score (0-100).
 */
async function assessBrandRelevanceBatch(
  ideas: GeneratedIdea[],
  topicName: string,
  styleProfile: StyleProfileInput,
  anthropicApiKey: string
): Promise<number[]> {
  if (ideas.length === 0) return [];

  const client = new Anthropic({ apiKey: anthropicApiKey });
  const model = process.env.CLAUDE_MODEL ?? DEFAULT_MODEL;

  const ideasSummary = ideas
    .map(
      (idea, i) =>
        `Idea ${i + 1}: [${idea.platform}/${idea.contentType}] "${idea.title}" — ${idea.description.slice(0, 200)}`
    )
    .join('\n');

  const systemPrompt = `You are a brand strategist assessing content idea fit. Respond ONLY with a valid JSON array of integers (0-100), one per idea, representing brand relevance. No markdown, no explanation, just the raw JSON array.`;

  const userPrompt = `Topic: ${topicName}

Brand voice: ${styleProfile.tone}, ${styleProfile.voiceCharacteristics.join(', ')}
Content themes: ${styleProfile.contentThemes.join(', ')}
Brand DO list: ${styleProfile.doList.join(' | ')}
Brand DON'T list: ${styleProfile.dontList.join(' | ')}

Rate each idea's brand fit (0 = completely off-brand, 100 = perfect brand fit):

${ideasSummary}

Return a JSON array with ${ideas.length} integers, e.g. [85, 72, 91]`;

  const start = Date.now();

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 200,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const latencyMs = Date.now() - start;
    const usage = response.usage;

    prioritiserLogger.info(
      {
        ideaCount: ideas.length,
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        latencyMs,
        estimatedCostUsd: ((usage.input_tokens * 3 + usage.output_tokens * 15) / 1_000_000).toFixed(
          4
        ),
      },
      'Claude: brand relevance assessed'
    );

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const cleaned = content.text
      .trim()
      .replace(/^```(?:json)?\n?/, '')
      .replace(/\n?```$/, '');
    const scores = JSON.parse(cleaned) as unknown;

    if (!Array.isArray(scores) || scores.length !== ideas.length) {
      throw new Error('Claude returned wrong number of scores');
    }

    return (scores as number[]).map((s) => Math.min(100, Math.max(0, Math.round(Number(s)))));
  } catch (err) {
    prioritiserLogger.warn(
      { err, ideaCount: ideas.length },
      'Brand relevance assessment failed, using defaults'
    );
    // Fall back to 50 (neutral) for all ideas
    return ideas.map(() => 50);
  }
}

/**
 * Scores all ideas using the priority formula and returns them sorted highest-first.
 */
export async function scoreAndPrioritiseIdeas(
  ideas: GeneratedIdea[],
  trend: TrendInput,
  topicName: string,
  styleProfile: StyleProfileInput,
  anthropicApiKey: string | null
): Promise<ScoredIdea[]> {
  if (ideas.length === 0) return [];

  const timeliness = calculateTimeliness(trend.discoveredAt);

  // Get brand relevance scores - use Claude if key available, else default to 60
  let brandRelevanceScores: number[];
  if (anthropicApiKey) {
    brandRelevanceScores = await assessBrandRelevanceBatch(
      ideas,
      topicName,
      styleProfile,
      anthropicApiKey
    );
  } else {
    prioritiserLogger.warn('No Anthropic key - using default brand relevance score of 60');
    brandRelevanceScores = ideas.map(() => 60);
  }

  const scored: ScoredIdea[] = ideas.map((idea, i) => {
    const viralityScore = trend.viralityScore;
    const brandRelevance = brandRelevanceScores[i] ?? 60;
    const platformFit = getPlatformFitScore(idea.platform, idea.contentType);

    const priorityScore = Math.round(
      viralityScore * 0.35 + brandRelevance * 0.35 + platformFit * 0.15 + timeliness * 0.15
    );

    return {
      ...idea,
      trendId: trend.id,
      viralityScore,
      brandRelevance,
      platformFit,
      timeliness,
      priorityScore: Math.min(100, Math.max(0, priorityScore)),
    };
  });

  prioritiserLogger.debug(
    {
      trendId: trend.id,
      ideas: scored.map((s) => ({
        platform: s.platform,
        priorityScore: s.priorityScore,
        viralityScore: s.viralityScore,
        brandRelevance: s.brandRelevance,
        platformFit: s.platformFit,
        timeliness: s.timeliness,
      })),
    },
    'Ideas scored'
  );

  return scored.sort((a, b) => b.priorityScore - a.priorityScore);
}
