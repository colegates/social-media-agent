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
import { QUEUE_NAMES, getContentIdeasQueue } from './lib/queue/queues';
import { initScheduler } from './lib/queue/scheduler';
import { runTrendScan } from './lib/agents/trend-scanner';
import { runContentCuration } from './lib/agents/content-curator';
import { runContentGeneration } from './lib/agents/content-generator';
import type {
  TrendScanJobData,
  ContentIdeasJobData,
  ContentGenerationJobData,
} from './lib/queue/queues';

const workerLogger = logger.child({ module: 'worker' });

// ─────────────────────────────────────────────────────────
// Worker instances (initialised inside start() to avoid
// throwing at module load time when REDIS_URL is absent)
// ─────────────────────────────────────────────────────────

let trendScanWorker: Worker<TrendScanJobData>;
let contentIdeasWorker: Worker<ContentIdeasJobData>;
let contentGenerationWorker: Worker<ContentGenerationJobData>;

// ─────────────────────────────────────────────────────────
// Startup
// ─────────────────────────────────────────────────────────

async function start(): Promise<void> {
  workerLogger.info('Background worker starting');

  const connection = getRedisConnectionOptions();

  // ─────────────────────────────────────────────────────
  // Trend Scan Worker
  // ─────────────────────────────────────────────────────

  trendScanWorker = new Worker<TrendScanJobData>(
    QUEUE_NAMES.TREND_SCAN,
    async (job) => {
      const jobLogger = workerLogger.child({
        jobId: job.id,
        jobName: job.name,
        topicId: job.data.topicId,
        scanJobId: job.data.scanJobId,
      });

      const startTime = Date.now();
      jobLogger.info({ isManual: job.data.isManual }, 'Trend scan job started');

      try {
        const result = await runTrendScan(job.data.topicId, job.data.userId, job.data.scanJobId);

        const duration = Date.now() - startTime;
        jobLogger.info({ trendsFound: result.trendsFound, duration }, 'Trend scan job completed');

        // Auto-trigger content idea generation when trends are found
        if (result.trendIds.length > 0) {
          try {
            await getContentIdeasQueue().add('generate-ideas', {
              topicId: job.data.topicId,
              userId: job.data.userId,
              trendIds: result.trendIds,
            });
            jobLogger.info(
              { trendIds: result.trendIds.length },
              'Content ideas job queued after trend scan'
            );
          } catch (queueErr) {
            jobLogger.warn({ err: queueErr }, 'Failed to queue content ideas job - non-fatal');
          }
        }

        return result;
      } catch (err) {
        const duration = Date.now() - startTime;
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

  // ─────────────────────────────────────────────────────
  // Content Ideas Worker (Stage 5 placeholder)
  // ─────────────────────────────────────────────────────

  contentIdeasWorker = new Worker<ContentIdeasJobData>(
    QUEUE_NAMES.CONTENT_IDEAS,
    async (job) => {
      const jobLogger = workerLogger.child({
        jobId: job.id,
        topicId: job.data.topicId,
        trendCount: job.data.trendIds.length,
      });

      const startTime = Date.now();
      jobLogger.info('Content ideas job started');

      try {
        const result = await runContentCuration(
          job.data.topicId,
          job.data.userId,
          job.data.trendIds
        );

        const duration = Date.now() - startTime;
        jobLogger.info(
          {
            ideasGenerated: result.ideasGenerated,
            ideasSaved: result.ideasSaved,
            ideasAutoApproved: result.ideasAutoApproved,
            duration,
          },
          'Content ideas job completed'
        );

        return result;
      } catch (err) {
        const duration = Date.now() - startTime;
        jobLogger.error({ err, duration }, 'Content ideas job failed');
        throw err;
      }
    },
    {
      connection,
      concurrency: 2,
    }
  );

  // ─────────────────────────────────────────────────────
  // Content Generation Worker (Stage 6 placeholder)
  // ─────────────────────────────────────────────────────

  contentGenerationWorker = new Worker<ContentGenerationJobData>(
    QUEUE_NAMES.CONTENT_GENERATION,
    async (job) => {
      const jobLogger = workerLogger.child({
        jobId: job.id,
        topicId: job.data.topicId,
        contentIdeaId: job.data.contentIdeaId,
        jobType: job.data.jobType,
      });

      const startTime = Date.now();
      jobLogger.info('Content generation job started');

      try {
        await job.updateProgress(10);
        const result = await runContentGeneration(job.data);
        await job.updateProgress(100);

        const duration = Date.now() - startTime;
        jobLogger.info(
          {
            generatedIds: result.generatedIds.length,
            totalCost: result.totalCost,
            errors: result.errors.length,
            duration,
          },
          'Content generation job completed'
        );

        return result;
      } catch (err) {
        const duration = Date.now() - startTime;
        jobLogger.error({ err, duration }, 'Content generation job failed');
        throw err;
      }
    },
    {
      connection,
      concurrency: 2,
      limiter: {
        max: 5,
        duration: 60_000, // max 5 generation jobs per minute (API rate limiting)
      },
    }
  );

  // ─────────────────────────────────────────────────────
  // Event Listeners
  // ─────────────────────────────────────────────────────

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
      trendScanWorker?.close(),
      contentIdeasWorker?.close(),
      contentGenerationWorker?.close(),
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
