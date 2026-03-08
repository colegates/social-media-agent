import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { sql, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { auth } from '@/lib/auth';
import { scanJobs, contentIdeas, topics } from '@/db/schema';
import { apiError } from '@/lib/utils/api-error';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const routeLogger = logger.child({ route: 'GET /api/health/detailed' });

  // This endpoint is authenticated — for internal/admin use
  const session = await auth();
  if (!session?.user?.id) {
    return apiError('UNAUTHORIZED', 'Authentication required');
  }

  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '0.1.0',
    userId: session.user.id,
  };

  // Database health
  try {
    const start = Date.now();
    await db.execute(sql`SELECT 1`);
    results.database = { status: 'ok', latencyMs: Date.now() - start };
  } catch (err) {
    results.database = { status: 'error', error: String(err) };
  }

  // Redis health
  if (process.env.REDIS_URL) {
    try {
      const start = Date.now();
      const { getRedisConnectionOptions } = await import('@/lib/queue/connection');
      const IORedis = (await import('ioredis')).default;
      const opts = getRedisConnectionOptions();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const redis = new IORedis(opts as any);
      // Suppress unhandled 'error' events — the try/catch handles failures
      redis.on('error', () => {});
      await redis.ping();
      const latency = Date.now() - start;
      await redis.quit();
      results.redis = { status: 'ok', latencyMs: latency };
    } catch (err) {
      results.redis = { status: 'error', error: String(err) };
    }
  } else {
    results.redis = { status: 'unconfigured' };
  }

  // Queue stats
  try {
    const { getTrendScanQueue, getContentIdeasQueue, getContentGenerationQueue } = await import(
      '@/lib/queue/queues'
    );

    const [scanQueue, ideasQueue, genQueue] = await Promise.all([
      getTrendScanQueue().getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
      getContentIdeasQueue().getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
      getContentGenerationQueue().getJobCounts(
        'waiting',
        'active',
        'completed',
        'failed',
        'delayed'
      ),
    ]);

    results.queues = {
      trendScan: scanQueue,
      contentIdeas: ideasQueue,
      contentGeneration: genQueue,
    };
  } catch {
    results.queues = { status: 'unavailable' };
  }

  // User-specific stats
  try {
    const userId = session.user.id;

    const [topicCount, recentScans, pendingIdeas] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(topics)
        .where(eq(topics.userId, userId)),
      db
        .select({
          id: scanJobs.id,
          status: scanJobs.status,
          startedAt: scanJobs.startedAt,
          trendsFound: scanJobs.trendsFound,
        })
        .from(scanJobs)
        .innerJoin(topics, eq(scanJobs.topicId, topics.id))
        .where(eq(topics.userId, userId))
        .orderBy(desc(scanJobs.startedAt))
        .limit(5),
      db
        .select({ count: sql<number>`count(*)` })
        .from(contentIdeas)
        .where(eq(contentIdeas.userId, userId)),
    ]);

    results.userStats = {
      topicCount: Number(topicCount[0]?.count ?? 0),
      recentScans,
      pendingIdeasCount: Number(pendingIdeas[0]?.count ?? 0),
    };
  } catch {
    results.userStats = { status: 'unavailable' };
  }

  // Environment checks (non-sensitive)
  results.environment = {
    nodeEnv: process.env.NODE_ENV,
    hasAnthropicKey: Boolean(process.env.ANTHROPIC_API_KEY),
    hasRedisUrl: Boolean(process.env.REDIS_URL),
    hasR2Config: Boolean(process.env.R2_BUCKET_NAME),
    hasSerpApi: Boolean(process.env.SERPAPI_KEY),
    hasApify: Boolean(process.env.APIFY_TOKEN),
    hasSentryDsn: Boolean(process.env.SENTRY_DSN),
  };

  routeLogger.info({ userId: session.user.id }, 'Detailed health check requested');

  return NextResponse.json(results);
}
