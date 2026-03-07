import { logger } from '@/lib/logger';
import { db } from '@/db';
import { topics, scanJobs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getTrendScanQueue, getContentIdeasQueue } from './queues';
import type { TrendScanJobData, ScheduledContentJobData } from './queues';

const schedulerLogger = logger.child({ module: 'scheduler' });

function getScanJobId(topicId: string): string {
  return `trend-scan:${topicId}`;
}

function getContentGenJobId(topicId: string): string {
  return `scheduled-content-gen:${topicId}`;
}

/**
 * Schedule a recurring web/social scan job for a topic.
 * Replaces any existing recurring scan job for the same topic.
 */
export async function scheduleTopicScan(
  topicId: string,
  userId: string,
  scanFrequencyMinutes: number
): Promise<void> {
  const queue = getTrendScanQueue();
  const jobId = getScanJobId(topicId);

  // Remove existing repeatable scan job for this topic if any
  const existingJobs = await queue.getRepeatableJobs();
  const existing = existingJobs.find((j) => j.key.includes(`trend-scan:${topicId}`));
  if (existing) {
    await queue.removeRepeatableByKey(existing.key);
    schedulerLogger.debug({ topicId, jobKey: existing.key }, 'Removed existing scan repeatable job');
  }

  // Create a scan job record in the DB
  const [scanJob] = await db
    .insert(scanJobs)
    .values({ topicId, status: 'pending', metadata: { scheduled: true } })
    .returning();

  const jobData: TrendScanJobData = {
    topicId,
    userId,
    scanJobId: scanJob.id,
    isManual: false,
  };

  await queue.add(jobId, jobData, {
    repeat: {
      every: scanFrequencyMinutes * 60 * 1000,
    },
    jobId,
  });

  schedulerLogger.info(
    { topicId, scanFrequencyMinutes, scanJobId: scanJob.id },
    'Scheduled recurring trend scan'
  );
}

/**
 * Remove the recurring scan job for a topic.
 */
export async function removeTopicScan(topicId: string): Promise<void> {
  const queue = getTrendScanQueue();
  const existingJobs = await queue.getRepeatableJobs();
  const existing = existingJobs.find((j) => j.key.includes(`trend-scan:${topicId}`));
  if (existing) {
    await queue.removeRepeatableByKey(existing.key);
    schedulerLogger.info({ topicId }, 'Removed recurring trend scan job');
  }
}

/**
 * Schedule a recurring content generation job for a topic.
 * When contentGenerationFrequencyMinutes is null, no recurring job is created.
 */
export async function scheduleTopicContentGeneration(
  topicId: string,
  userId: string,
  contentGenerationFrequencyMinutes: number | null
): Promise<void> {
  const queue = getContentIdeasQueue();

  // Remove existing content generation repeatable job if any
  const existingJobs = await queue.getRepeatableJobs();
  const existing = existingJobs.find((j) => j.key.includes(`scheduled-content-gen:${topicId}`));
  if (existing) {
    await queue.removeRepeatableByKey(existing.key);
    schedulerLogger.debug(
      { topicId, jobKey: existing.key },
      'Removed existing content generation repeatable job'
    );
  }

  if (contentGenerationFrequencyMinutes === null) {
    schedulerLogger.info(
      { topicId },
      'Content generation scheduling disabled for topic'
    );
    return;
  }

  const jobId = getContentGenJobId(topicId);
  const jobData: ScheduledContentJobData = {
    topicId,
    userId,
    isScheduled: true,
  };

  await queue.add(jobId, jobData, {
    repeat: {
      every: contentGenerationFrequencyMinutes * 60 * 1000,
    },
    jobId,
  });

  schedulerLogger.info(
    { topicId, contentGenerationFrequencyMinutes },
    'Scheduled recurring content generation'
  );
}

/**
 * Remove the recurring content generation job for a topic.
 */
export async function removeTopicContentGeneration(topicId: string): Promise<void> {
  const queue = getContentIdeasQueue();
  const existingJobs = await queue.getRepeatableJobs();
  const existing = existingJobs.find((j) => j.key.includes(`scheduled-content-gen:${topicId}`));
  if (existing) {
    await queue.removeRepeatableByKey(existing.key);
    schedulerLogger.info({ topicId }, 'Removed recurring content generation job');
  }
}

/**
 * Trigger an immediate (manual) scan for a topic.
 * Returns the scan job ID.
 */
export async function triggerImmediateScan(topicId: string, userId: string): Promise<string> {
  const queue = getTrendScanQueue();

  // Create a scan job record
  const [scanJob] = await db
    .insert(scanJobs)
    .values({ topicId, status: 'pending', metadata: { manual: true } })
    .returning();

  const jobData: TrendScanJobData = {
    topicId,
    userId,
    scanJobId: scanJob.id,
    isManual: true,
  };

  await queue.add(`manual-scan:${topicId}:${Date.now()}`, jobData, {
    priority: 1, // High priority for manual scans
  });

  schedulerLogger.info({ topicId, scanJobId: scanJob.id }, 'Triggered manual trend scan');
  return scanJob.id;
}

/**
 * On app startup, initialise recurring scan jobs and content generation jobs for all active topics.
 */
export async function initScheduler(): Promise<void> {
  schedulerLogger.info('Initialising scan scheduler');

  try {
    const activeTopics = await db.query.topics.findMany({
      where: eq(topics.isActive, true),
      columns: {
        id: true,
        userId: true,
        scanFrequencyMinutes: true,
        contentGenerationFrequencyMinutes: true,
      },
    });

    schedulerLogger.info({ count: activeTopics.length }, 'Found active topics to schedule');

    for (const topic of activeTopics) {
      try {
        await scheduleTopicScan(topic.id, topic.userId, topic.scanFrequencyMinutes);
      } catch (err) {
        schedulerLogger.error({ err, topicId: topic.id }, 'Failed to schedule topic scan');
      }

      try {
        await scheduleTopicContentGeneration(
          topic.id,
          topic.userId,
          topic.contentGenerationFrequencyMinutes ?? null
        );
      } catch (err) {
        schedulerLogger.error(
          { err, topicId: topic.id },
          'Failed to schedule topic content generation'
        );
      }
    }

    schedulerLogger.info('Scan scheduler initialised');
  } catch (err) {
    schedulerLogger.error({ err }, 'Failed to initialise scan scheduler');
  }
}
