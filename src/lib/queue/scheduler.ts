import { logger } from '@/lib/logger';
import { db } from '@/db';
import { topics, scanJobs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getTrendScanQueue } from './queues';
import type { TrendScanJobData } from './queues';

const schedulerLogger = logger.child({ module: 'scheduler' });

function getRepeatableJobId(topicId: string): string {
  return `trend-scan:${topicId}`;
}

/**
 * Schedule a recurring scan job for a topic based on its scanFrequencyMinutes.
 * Replaces any existing recurring job for the same topic.
 */
export async function scheduleTopicScan(
  topicId: string,
  userId: string,
  scanFrequencyMinutes: number
): Promise<void> {
  const queue = getTrendScanQueue();
  const jobId = getRepeatableJobId(topicId);

  // Remove existing repeatable job for this topic if any
  const existingJobs = await queue.getRepeatableJobs();
  const existing = existingJobs.find((j) => j.key.includes(topicId));
  if (existing) {
    await queue.removeRepeatableByKey(existing.key);
    schedulerLogger.debug({ topicId, jobKey: existing.key }, 'Removed existing repeatable job');
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
  const existing = existingJobs.find((j) => j.key.includes(topicId));
  if (existing) {
    await queue.removeRepeatableByKey(existing.key);
    schedulerLogger.info({ topicId }, 'Removed recurring trend scan job');
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
 * On app startup, initialise recurring scan jobs for all active topics.
 */
export async function initScheduler(): Promise<void> {
  schedulerLogger.info('Initialising scan scheduler');

  try {
    const activeTopics = await db.query.topics.findMany({
      where: eq(topics.isActive, true),
      columns: { id: true, userId: true, scanFrequencyMinutes: true },
    });

    schedulerLogger.info({ count: activeTopics.length }, 'Found active topics to schedule');

    for (const topic of activeTopics) {
      try {
        await scheduleTopicScan(topic.id, topic.userId, topic.scanFrequencyMinutes);
      } catch (err) {
        schedulerLogger.error({ err, topicId: topic.id }, 'Failed to schedule topic scan');
      }
    }

    schedulerLogger.info('Scan scheduler initialised');
  } catch (err) {
    schedulerLogger.error({ err }, 'Failed to initialise scan scheduler');
  }
}
