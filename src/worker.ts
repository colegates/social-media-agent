/**
 * Background Worker Entry Point
 *
 * Processes all BullMQ jobs:
 * - trend-scan: Runs trend scans for topics
 * - content-ideas: Generates content ideas from trends (Stage 5)
 * - content-generation: Generates actual content (Stage 6)
 *
 * Start with: npm run worker
 */

import { Worker } from 'bullmq';
import { logger } from './lib/logger';
import { getRedisConnectionOptions, closeRedisConnection } from './lib/queue/connection';
import { QUEUE_NAMES } from './lib/queue/queues';
import { initScheduler } from './lib/queue/scheduler';
import { runTrendScan } from './lib/agents/trend-scanner';
import type { TrendScanJobData, ContentIdeasJobData, ContentGenerationJobData } from './lib/queue/queues';

const workerLogger = logger.child({ module: 'worker' });

const connection = getRedisConnectionOptions();

// ─────────────────────────────────────────────────────────
// Trend Scan Worker
// ─────────────────────────────────────────────────────────

const trendScanWorker = new Worker<TrendScanJobData>(
  QUEUE_NAMES.TREND_SCAN,
  async (job) => {
    const jobLogger = workerLogger.child({
      jobId: job.id,
      jobName: job.name,
      topicId: job.data.topicId,
      scanJobId: job.data.scanJobId,
    });

    const start = Date.now();
    jobLogger.info({ isManual: job.data.isManual }, 'Trend scan job started');

    try {
      const result = await runTrendScan(
        job.data.topicId,
        job.data.userId,
        job.data.scanJobId
      );

      const duration = Date.now() - start;
      jobLogger.info({ trendsFound: result.trendsFound, duration }, 'Trend scan job completed');

      return result;
    } catch (err) {
      const duration = Date.now() - start;
      jobLogger.error({ err, duration }, 'Trend scan job failed');
      throw err;
    }
  },
  {
    connection,
    concurrency: 3,
    limiter: {
      max: 5,
      duration: 60_000, // max 5 scans per minute
    },
  }
);

// ─────────────────────────────────────────────────────────
// Content Ideas Worker (Stage 5 placeholder)
// ─────────────────────────────────────────────────────────

const contentIdeasWorker = new Worker<ContentIdeasJobData>(
  QUEUE_NAMES.CONTENT_IDEAS,
  async (job) => {
    const jobLogger = workerLogger.child({
      jobId: job.id,
      topicId: job.data.topicId,
      trendCount: job.data.trendIds.length,
    });
    jobLogger.info('Content ideas job received (Stage 5 - not yet implemented)');
    // Stage 5 will implement this
  },
  {
    connection,
    concurrency: 2,
  }
);

// ─────────────────────────────────────────────────────────
// Content Generation Worker (Stage 6 placeholder)
// ─────────────────────────────────────────────────────────

const contentGenerationWorker = new Worker<ContentGenerationJobData>(
  QUEUE_NAMES.CONTENT_GENERATION,
  async (job) => {
    const jobLogger = workerLogger.child({
      jobId: job.id,
      topicId: job.data.topicId,
      contentIdeaId: job.data.contentIdeaId,
    });
    jobLogger.info('Content generation job received (Stage 6 - not yet implemented)');
    // Stage 6 will implement this
  },
  {
    connection,
    concurrency: 2,
  }
);

// ─────────────────────────────────────────────────────────
// Event Listeners
// ─────────────────────────────────────────────────────────

trendScanWorker.on('completed', (job) => {
  workerLogger.info({ jobId: job.id, jobName: job.name }, 'Job completed');
});

trendScanWorker.on('failed', (job, err) => {
  workerLogger.error({ jobId: job?.id, jobName: job?.name, err }, 'Job failed');
});

trendScanWorker.on('error', (err) => {
  workerLogger.error({ err }, 'Trend scan worker error');
});

contentIdeasWorker.on('error', (err) => {
  workerLogger.error({ err }, 'Content ideas worker error');
});

contentGenerationWorker.on('error', (err) => {
  workerLogger.error({ err }, 'Content generation worker error');
});

// ─────────────────────────────────────────────────────────
// Startup
// ─────────────────────────────────────────────────────────

async function start(): Promise<void> {
  workerLogger.info('Background worker starting');

  // Initialise recurring job scheduler
  await initScheduler();

  workerLogger.info(
    {
      queues: Object.values(QUEUE_NAMES),
      concurrency: { trendScan: 3, contentIdeas: 2, contentGeneration: 2 },
    },
    'Worker ready, listening for jobs'
  );
}

// ─────────────────────────────────────────────────────────
// Graceful Shutdown
// ─────────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  workerLogger.info({ signal }, 'Shutdown signal received, closing workers');

  try {
    await Promise.all([
      trendScanWorker.close(),
      contentIdeasWorker.close(),
      contentGenerationWorker.close(),
    ]);

    await closeRedisConnection();
    workerLogger.info('Worker shutdown complete');
    process.exit(0);
  } catch (err) {
    workerLogger.error({ err }, 'Error during shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  workerLogger.error({ reason }, 'Unhandled promise rejection');
});

start().catch((err) => {
  workerLogger.error({ err }, 'Failed to start worker');
  process.exit(1);
});
