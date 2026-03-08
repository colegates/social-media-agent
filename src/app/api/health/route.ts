import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { sql } from 'drizzle-orm';
import { db } from '@/db';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const routeLogger = logger.child({ route: 'GET /api/health' });

  let dbStatus: 'ok' | 'error' = 'error';
  let dbError: string | null = null;
  let redisStatus: 'ok' | 'error' | 'unconfigured' = 'unconfigured';

  // Check database
  try {
    await db.execute(sql`SELECT 1`);
    dbStatus = 'ok';
  } catch (err: unknown) {
    const e = err as Record<string, unknown>;
    const cause = (e.cause ?? {}) as Record<string, unknown>;
    dbError = String(cause.message ?? e.message ?? 'unknown error');
    routeLogger.error({ error: dbError }, 'Health check: DB connection failed');
  }

  // Check Redis connectivity
  if (process.env.REDIS_URL) {
    try {
      const { getRedisConnectionOptions } = await import('@/lib/queue/connection');
      const IORedis = (await import('ioredis')).default;
      const opts = getRedisConnectionOptions();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const redis = new IORedis(opts as any);
      // Suppress unhandled 'error' events — the try/catch handles failures
      redis.on('error', () => {});
      await redis.ping();
      await redis.quit();
      redisStatus = 'ok';
    } catch {
      redisStatus = 'error';
    }
  }

  const allOk = dbStatus === 'ok' && (redisStatus === 'ok' || redisStatus === 'unconfigured');

  const response = {
    status: allOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '0.1.0',
    services: {
      database: { status: dbStatus, error: dbError },
      redis: { status: redisStatus },
    },
  };

  routeLogger.debug(response, 'Health check requested');

  return NextResponse.json(response, { status: allOk ? 200 : 503 });
}
