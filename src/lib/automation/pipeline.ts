import { db } from '@/db';
import {
  topics,
  contentIdeas,
  generatedContent,
  automationLogs,
  scanJobs,
} from '@/db/schema';
import { and, eq, gte, desc } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import {
  getTrendScanQueue,
  getContentIdeasQueue,
  getContentGenerationQueue,
} from '@/lib/queue/queues';
import { evaluateRules, executeAction } from './rules-engine';
import type { ActionConfig } from './rules-engine';
import { sendNotification } from './notification-service';

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export interface PipelineRunOptions {
  topicId: string;
  userId: string;
  /** When true skip triggering a new trend scan (assume scan already done) */
  skipScan?: boolean;
}

export interface PipelineStatus {
  topicId: string;
  topicName: string;
  isRunning: boolean;
  lastScanAt?: Date;
  pendingIdeas: number;
  pendingContent: number;
  recentErrors: number;
}

// ─────────────────────────────────────────────────────────
// Pipeline orchestrator
// ─────────────────────────────────────────────────────────

export async function runFullPipeline(options: PipelineRunOptions): Promise<void> {
  const { topicId, userId } = options;
  const pipelineLogger = logger.child({ topicId, userId, pipeline: 'full' });

  pipelineLogger.info('Full automation pipeline started');

  // Verify topic exists and belongs to user
  const [topic] = await db
    .select()
    .from(topics)
    .where(and(eq(topics.id, topicId), eq(topics.userId, userId)))
    .limit(1);

  if (!topic) {
    pipelineLogger.error('Topic not found or unauthorised');
    return;
  }

  if (!topic.isActive) {
    pipelineLogger.info('Topic is inactive — skipping pipeline');
    return;
  }

  try {
    // Step 1: Trigger trend scan (unless skipped)
    if (!options.skipScan) {
      await triggerTrendScan({ topicId, userId });
    }

    // Step 2: Evaluate after_scan rules
    const context = { topicId, userId, triggerType: 'after_scan' as const };
    const ruleResults = await evaluateRules(context);

    for (const result of ruleResults) {
      if (!result.matched) continue;

      for (const action of result.actionsToExecute) {
        if (action.type === 'send_notification') {
          await sendNotification({
            userId,
            type: 'new_trends',
            title: 'New trends discovered',
            body: `Automation rule "${result.ruleName}" triggered after scan on topic "${topic.name}"`,
            data: { topicId, url: `/topics/${topicId}` },
          });
        } else {
          await executeAction(action, context, result.ruleId, result.ruleName);
        }
      }
    }

    pipelineLogger.info('Automation pipeline step 1 (scan trigger) completed');
  } catch (err) {
    pipelineLogger.error({ err }, 'Pipeline failed at step 1 (scan)');
    await logPipelineError(userId, topicId, 'scan_step', String(err));
  }
}

// ─────────────────────────────────────────────────────────
// Step: Trigger trend scan
// ─────────────────────────────────────────────────────────

async function triggerTrendScan(opts: { topicId: string; userId: string }): Promise<void> {
  const { topicId, userId } = opts;
  const scanLogger = logger.child({ topicId, userId, step: 'trend_scan' });

  // Create a scan job record
  const [scanJob] = await db
    .insert(scanJobs)
    .values({ topicId, status: 'pending' })
    .returning({ id: scanJobs.id });

  const queue = getTrendScanQueue();
  await queue.add(
    'trend-scan',
    { topicId, userId, scanJobId: scanJob.id, isManual: false },
    { jobId: `trend-scan-${topicId}-${Date.now()}` }
  );

  scanLogger.info({ scanJobId: scanJob.id }, 'Trend scan enqueued');
}

// ─────────────────────────────────────────────────────────
// Called by worker after trend scan completes
// ─────────────────────────────────────────────────────────

export async function onScanCompleted(opts: {
  topicId: string;
  userId: string;
  trendIds: string[];
  trendsFound: number;
}): Promise<void> {
  const { topicId, userId, trendIds, trendsFound } = opts;
  const stepLogger = logger.child({ topicId, userId, step: 'post_scan' });

  stepLogger.info({ trendsFound }, 'Scan completed — evaluating post-scan rules');

  try {
    // Evaluate auto_approve + auto_generate rules
    const context = {
      topicId,
      userId,
      triggerType: 'after_scan' as const,
      trendIds,
    };
    const ruleResults = await evaluateRules(context);

    let shouldAutoGenerateIdeas = false;

    for (const result of ruleResults) {
      if (!result.matched) continue;

      for (const action of result.actionsToExecute as ActionConfig[]) {
        switch (action.type) {
          case 'auto_generate':
            shouldAutoGenerateIdeas = true;
            break;
          case 'send_notification':
            await sendNotification({
              userId,
              type: 'new_trends',
              title: `${trendsFound} new trends found`,
              body: `Automation scanned and found ${trendsFound} new trends. Tap to review.`,
              data: { topicId, url: `/topics/${topicId}` },
            });
            break;
          default:
            await executeAction(action, context, result.ruleId, result.ruleName);
        }
      }
    }

    // Enqueue content ideas generation if auto-generate enabled
    if (shouldAutoGenerateIdeas && trendIds.length > 0) {
      const queue = getContentIdeasQueue();
      await queue.add(
        'content-ideas',
        { topicId, userId, trendIds },
        { jobId: `content-ideas-${topicId}-${Date.now()}` }
      );
      stepLogger.info({ trendCount: trendIds.length }, 'Content ideas generation enqueued');
    }

    // Notify if no auto-generate, so user knows trends are ready
    if (!shouldAutoGenerateIdeas && trendsFound > 0) {
      await sendNotification({
        userId,
        type: 'new_trends',
        title: `${trendsFound} new trends found`,
        body: 'New trending topics are ready for you to review.',
        data: { topicId, url: `/topics/${topicId}` },
      });
    }
  } catch (err) {
    stepLogger.error({ err }, 'Post-scan pipeline step failed');
    await logPipelineError(userId, topicId, 'post_scan', String(err));
  }
}

// ─────────────────────────────────────────────────────────
// Called by worker after content ideas are generated
// ─────────────────────────────────────────────────────────

export async function onIdeasGenerated(opts: {
  topicId: string;
  userId: string;
  ideaIds: string[];
}): Promise<void> {
  const { topicId, userId, ideaIds } = opts;
  const stepLogger = logger.child({ topicId, userId, step: 'post_ideas', ideaCount: ideaIds.length });

  stepLogger.info('Ideas generated — evaluating auto-approve rules');

  try {
    const context = {
      topicId,
      userId,
      triggerType: 'after_scan' as const,
      ideaIds,
    };
    const ruleResults = await evaluateRules(context);

    let autoApproved = false;
    let shouldAutoGenerateContent = false;

    for (const result of ruleResults) {
      if (!result.matched) continue;

      for (const action of result.actionsToExecute as ActionConfig[]) {
        switch (action.type) {
          case 'auto_approve':
            await executeAction(action, context, result.ruleId, result.ruleName);
            autoApproved = true;
            break;
          case 'auto_generate':
            shouldAutoGenerateContent = true;
            break;
          case 'send_notification':
            await sendNotification({
              userId,
              type: 'ideas_ready',
              title: `${ideaIds.length} content ideas ready`,
              body: 'New content ideas have been generated and are awaiting your approval.',
              data: { topicId, url: `/content/ideas` },
            });
            break;
          default:
            await executeAction(action, context, result.ruleId, result.ruleName);
        }
      }
    }

    // If ideas were auto-approved and auto-generate is on, enqueue content generation
    if (autoApproved && shouldAutoGenerateContent) {
      await triggerContentGenerationForApprovedIdeas({ topicId, userId });
    }

    // Send notification unless one was already sent
    if (!autoApproved) {
      await sendNotification({
        userId,
        type: 'ideas_ready',
        title: `${ideaIds.length} content ideas ready for review`,
        body: 'Tap to review and approve your content ideas.',
        data: { topicId, url: `/content/ideas` },
      });
    }
  } catch (err) {
    stepLogger.error({ err }, 'Post-ideas pipeline step failed');
    await logPipelineError(userId, topicId, 'post_ideas', String(err));
  }
}

// ─────────────────────────────────────────────────────────
// Called by worker after content is generated
// ─────────────────────────────────────────────────────────

export async function onContentGenerated(opts: {
  topicId: string;
  userId: string;
  contentId: string;
  contentIdeaId: string;
}): Promise<void> {
  const { topicId, userId, contentId } = opts;
  const stepLogger = logger.child({ topicId, userId, contentId, step: 'post_content' });

  stepLogger.info('Content generated — evaluating auto-publish rules');

  try {
    const context = {
      topicId,
      userId,
      triggerType: 'after_scan' as const,
      contentIds: [contentId],
    };
    const ruleResults = await evaluateRules(context);

    let autoPublish = false;

    for (const result of ruleResults) {
      if (!result.matched) continue;

      for (const action of result.actionsToExecute as ActionConfig[]) {
        if (action.type === 'auto_publish') {
          await executeAction(action, context, result.ruleId, result.ruleName);
          autoPublish = true;
        }
      }
    }

    if (autoPublish) {
      await sendNotification({
        userId,
        type: 'auto_published',
        title: 'Content auto-published',
        body: 'Your content has been automatically published.',
        data: { contentId, url: `/content/library` },
      });
    } else {
      await sendNotification({
        userId,
        type: 'review_needed',
        title: 'Content ready for review',
        body: 'New content has been generated and is awaiting your review.',
        data: { contentId, url: `/content/review` },
      });
    }
  } catch (err) {
    stepLogger.error({ err }, 'Post-content pipeline step failed');
    await logPipelineError(userId, topicId, 'post_content', String(err));
  }
}

// ─────────────────────────────────────────────────────────
// Helper: trigger content generation for all approved ideas
// ─────────────────────────────────────────────────────────

async function triggerContentGenerationForApprovedIdeas(opts: {
  topicId: string;
  userId: string;
}): Promise<void> {
  const { topicId, userId } = opts;

  const approvedIdeas = await db
    .select({ id: contentIdeas.id, platform: contentIdeas.platform, contentType: contentIdeas.contentType })
    .from(contentIdeas)
    .where(
      and(
        eq(contentIdeas.topicId, topicId),
        eq(contentIdeas.userId, userId),
        eq(contentIdeas.status, 'approved')
      )
    )
    .limit(10);

  const queue = getContentGenerationQueue();

  for (const idea of approvedIdeas) {
    await queue.add(
      'content-generation',
      {
        topicId,
        userId,
        contentIdeaId: idea.id,
        platform: idea.platform,
        contentType: idea.contentType,
        jobType: 'generate_all',
      },
      { jobId: `content-gen-${idea.id}-${Date.now()}` }
    );
  }

  logger.info(
    { topicId, userId, ideaCount: approvedIdeas.length },
    'Content generation enqueued for approved ideas'
  );
}

// ─────────────────────────────────────────────────────────
// Dashboard: pipeline status per topic
// ─────────────────────────────────────────────────────────

export async function getPipelineStatus(userId: string): Promise<PipelineStatus[]> {
  const userTopics = await db
    .select({ id: topics.id, name: topics.name, isActive: topics.isActive })
    .from(topics)
    .where(and(eq(topics.userId, userId), eq(topics.isActive, true)));

  const statuses: PipelineStatus[] = [];
  const cutoff = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

  for (const topic of userTopics) {
    const [pendingIdeasCount] = await db
      .select({ count: contentIdeas.id })
      .from(contentIdeas)
      .where(
        and(
          eq(contentIdeas.topicId, topic.id),
          eq(contentIdeas.userId, userId),
          eq(contentIdeas.status, 'suggested')
        )
      );

    const [pendingContentCount] = await db
      .select({ count: generatedContent.id })
      .from(generatedContent)
      .where(
        and(
          eq(generatedContent.userId, userId),
          eq(generatedContent.status, 'completed')
        )
      );

    const recentErrors = await db
      .select()
      .from(automationLogs)
      .where(
        and(
          eq(automationLogs.userId, userId),
          eq(automationLogs.topicId, topic.id),
          eq(automationLogs.status, 'failed'),
          gte(automationLogs.createdAt, cutoff)
        )
      )
      .limit(5);

    statuses.push({
      topicId: topic.id,
      topicName: topic.name,
      isRunning: false,
      pendingIdeas: pendingIdeasCount ? 1 : 0,
      pendingContent: pendingContentCount ? 1 : 0,
      recentErrors: recentErrors.length,
    });
  }

  return statuses;
}

// ─────────────────────────────────────────────────────────
// Helper: log pipeline error
// ─────────────────────────────────────────────────────────

async function logPipelineError(
  userId: string,
  topicId: string,
  step: string,
  errorMsg: string
): Promise<void> {
  try {
    await db.insert(automationLogs).values({
      userId,
      topicId,
      action: `pipeline:${step}`,
      status: 'failed',
      details: { error: errorMsg },
    });

    await sendNotification({
      userId,
      type: 'error',
      title: 'Automation pipeline error',
      body: `An error occurred during the ${step} step. Check automation logs.`,
      data: { topicId, url: '/settings/automation' },
    });
  } catch (err) {
    logger.error({ err }, 'Failed to log pipeline error');
  }
}
