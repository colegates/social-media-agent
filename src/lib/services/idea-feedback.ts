/**
 * Idea Feedback Service
 *
 * Records approval/rejection signals per user and per topic.
 * Feedback is stored in users.settings.ideaFeedback (JSONB) so it's lightweight
 * and available to the content curator on every generation run without a separate
 * DB table.
 *
 * Structure stored in users.settings:
 * {
 *   ideaFeedback: {
 *     approvedPlatforms: Record<string, number>       // platform → approve count
 *     rejectedPlatforms: Record<string, number>       // platform → reject count
 *     approvedContentTypes: Record<string, number>
 *     rejectedContentTypes: Record<string, number>
 *     recentApprovedTitles: string[]                  // last 20 approved idea titles
 *     recentRejectedTitles: string[]                  // last 20 rejected idea titles
 *     totalApproved: number
 *     totalRejected: number
 *   }
 * }
 */

import { logger } from '@/lib/logger';
import { db } from '@/db';
import { contentIdeas, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

const feedbackLogger = logger.child({ module: 'idea-feedback' });

export interface IdeaFeedback {
  approvedPlatforms: Record<string, number>;
  rejectedPlatforms: Record<string, number>;
  approvedContentTypes: Record<string, number>;
  rejectedContentTypes: Record<string, number>;
  recentApprovedTitles: string[];
  recentRejectedTitles: string[];
  totalApproved: number;
  totalRejected: number;
}

const RECENT_TITLES_LIMIT = 20;

function emptyFeedback(): IdeaFeedback {
  return {
    approvedPlatforms: {},
    rejectedPlatforms: {},
    approvedContentTypes: {},
    rejectedContentTypes: {},
    recentApprovedTitles: [],
    recentRejectedTitles: [],
    totalApproved: 0,
    totalRejected: 0,
  };
}

function parseFeedback(raw: unknown): IdeaFeedback {
  if (raw === null || typeof raw !== 'object') return emptyFeedback();
  const r = raw as Record<string, unknown>;
  return {
    approvedPlatforms:
      typeof r.approvedPlatforms === 'object' && r.approvedPlatforms !== null
        ? (r.approvedPlatforms as Record<string, number>)
        : {},
    rejectedPlatforms:
      typeof r.rejectedPlatforms === 'object' && r.rejectedPlatforms !== null
        ? (r.rejectedPlatforms as Record<string, number>)
        : {},
    approvedContentTypes:
      typeof r.approvedContentTypes === 'object' && r.approvedContentTypes !== null
        ? (r.approvedContentTypes as Record<string, number>)
        : {},
    rejectedContentTypes:
      typeof r.rejectedContentTypes === 'object' && r.rejectedContentTypes !== null
        ? (r.rejectedContentTypes as Record<string, number>)
        : {},
    recentApprovedTitles: Array.isArray(r.recentApprovedTitles)
      ? (r.recentApprovedTitles as string[])
      : [],
    recentRejectedTitles: Array.isArray(r.recentRejectedTitles)
      ? (r.recentRejectedTitles as string[])
      : [],
    totalApproved: typeof r.totalApproved === 'number' ? r.totalApproved : 0,
    totalRejected: typeof r.totalRejected === 'number' ? r.totalRejected : 0,
  };
}

/**
 * Record that a content idea was approved.
 * Updates the user's feedback counters non-blocking (fire-and-forget pattern
 * is safe here — the status update has already been committed).
 */
export async function recordIdeaApproved(userId: string, ideaId: string): Promise<void> {
  try {
    const idea = await db.query.contentIdeas.findFirst({
      where: and(eq(contentIdeas.id, ideaId), eq(contentIdeas.userId, userId)),
      columns: { platform: true, contentType: true, title: true },
    });

    if (!idea) return;

    await updateFeedback(userId, (fb) => {
      fb.approvedPlatforms[idea.platform] = (fb.approvedPlatforms[idea.platform] ?? 0) + 1;
      fb.approvedContentTypes[idea.contentType] =
        (fb.approvedContentTypes[idea.contentType] ?? 0) + 1;
      fb.recentApprovedTitles = [idea.title, ...fb.recentApprovedTitles].slice(
        0,
        RECENT_TITLES_LIMIT
      );
      fb.totalApproved += 1;
      return fb;
    });

    feedbackLogger.debug({ userId, ideaId, platform: idea.platform }, 'Recorded idea approval');
  } catch (err) {
    // Non-fatal — don't fail the approve action over a feedback recording error
    feedbackLogger.warn({ err, userId, ideaId }, 'Failed to record idea approval feedback');
  }
}

/**
 * Record that a content idea was rejected.
 */
export async function recordIdeaRejected(userId: string, ideaId: string): Promise<void> {
  try {
    const idea = await db.query.contentIdeas.findFirst({
      where: and(eq(contentIdeas.id, ideaId), eq(contentIdeas.userId, userId)),
      columns: { platform: true, contentType: true, title: true },
    });

    if (!idea) return;

    await updateFeedback(userId, (fb) => {
      fb.rejectedPlatforms[idea.platform] = (fb.rejectedPlatforms[idea.platform] ?? 0) + 1;
      fb.rejectedContentTypes[idea.contentType] =
        (fb.rejectedContentTypes[idea.contentType] ?? 0) + 1;
      fb.recentRejectedTitles = [idea.title, ...fb.recentRejectedTitles].slice(
        0,
        RECENT_TITLES_LIMIT
      );
      fb.totalRejected += 1;
      return fb;
    });

    feedbackLogger.debug({ userId, ideaId, platform: idea.platform }, 'Recorded idea rejection');
  } catch (err) {
    feedbackLogger.warn({ err, userId, ideaId }, 'Failed to record idea rejection feedback');
  }
}

/**
 * Load the current feedback for a user.
 */
export async function getUserIdeaFeedback(userId: string): Promise<IdeaFeedback> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { settings: true },
  });

  const settings = (user?.settings ?? {}) as Record<string, unknown>;
  return parseFeedback(settings.ideaFeedback);
}

/**
 * Build a human-readable feedback context string for Claude prompts.
 * Summarises what platforms and content types the user tends to like or dislike.
 */
export function buildFeedbackContext(feedback: IdeaFeedback): string | null {
  if (feedback.totalApproved === 0 && feedback.totalRejected === 0) return null;

  const lines: string[] = [
    `The user has reviewed ${feedback.totalApproved + feedback.totalRejected} content ideas so far.`,
  ];

  if (feedback.totalApproved > 0) {
    const topApprovedPlatforms = topEntries(feedback.approvedPlatforms, 3);
    const topApprovedTypes = topEntries(feedback.approvedContentTypes, 3);

    lines.push(
      `Preferred platforms (most approved): ${topApprovedPlatforms.map(([k, v]) => `${k} (${v})`).join(', ')}.`
    );
    lines.push(
      `Preferred content types: ${topApprovedTypes.map(([k, v]) => `${k} (${v})`).join(', ')}.`
    );

    if (feedback.recentApprovedTitles.length > 0) {
      lines.push(
        `Recent approved ideas (use as style reference): ${feedback.recentApprovedTitles.slice(0, 5).map((t) => `"${t}"`).join(', ')}.`
      );
    }
  }

  if (feedback.totalRejected > 0) {
    const topRejectedPlatforms = topEntries(feedback.rejectedPlatforms, 3);
    const topRejectedTypes = topEntries(feedback.rejectedContentTypes, 3);

    if (topRejectedPlatforms.length > 0) {
      lines.push(
        `Platforms the user tends to reject: ${topRejectedPlatforms.map(([k, v]) => `${k} (${v})`).join(', ')} — avoid over-generating for these.`
      );
    }
    if (topRejectedTypes.length > 0) {
      lines.push(
        `Content types often rejected: ${topRejectedTypes.map(([k, v]) => `${k} (${v})`).join(', ')}.`
      );
    }

    if (feedback.recentRejectedTitles.length > 0) {
      lines.push(
        `Recent rejected ideas (avoid similar angles): ${feedback.recentRejectedTitles.slice(0, 5).map((t) => `"${t}"`).join(', ')}.`
      );
    }
  }

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

async function updateFeedback(
  userId: string,
  mutate: (fb: IdeaFeedback) => IdeaFeedback
): Promise<void> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { settings: true },
  });

  const settings = ((user?.settings ?? {}) as Record<string, unknown>);
  const feedback = parseFeedback(settings.ideaFeedback);
  const updated = mutate(feedback);

  await db
    .update(users)
    .set({ settings: { ...settings, ideaFeedback: updated } })
    .where(eq(users.id, userId));
}

function topEntries(
  record: Record<string, number>,
  n: number
): [string, number][] {
  return Object.entries(record)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n);
}
