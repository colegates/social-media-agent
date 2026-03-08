import type { ConnectionOptions } from 'bullmq';
import { logger } from '@/lib/logger';

const connectionLogger = logger.child({ module: 'redis' });

/**
 * Exponential backoff retry strategy for ioredis.
 * Without this, ioredis retries every ~100ms — when Upstash is rate-limited
 * each AUTH attempt burns quota, creating a feedback loop that re-exhausts
 * the daily limit within seconds of it resetting.
 *
 * This caps retries at 60 seconds, reducing attempts from thousands/minute
 * to a handful/minute once the backoff ceiling is reached.
 */
function retryStrategy(times: number): number {
  // 1s → 2s → 4s → 8s → 16s → 32s → 60s (cap)
  const delay = Math.min(1000 * Math.pow(2, times - 1), 60_000);
  connectionLogger.warn({ attempt: times, delayMs: delay }, 'Redis reconnect attempt');
  return delay;
}

/**
 * Returns BullMQ-compatible connection options parsed from REDIS_URL.
 * We pass options (not an ioredis instance) to avoid type conflicts between
 * standalone ioredis and BullMQ's internal bundled version.
 */
export function getRedisConnectionOptions(): ConnectionOptions {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL environment variable is not set');
  }

  connectionLogger.debug(
    { redisUrl: redisUrl.replace(/:[^:@]+@/, ':***@') },
    'Building Redis connection options'
  );

  try {
    const parsed = new URL(redisUrl);
    const isTls = parsed.protocol === 'rediss:';

    return {
      host: parsed.hostname,
      port: parsed.port ? parseInt(parsed.port, 10) : isTls ? 6380 : 6379,
      ...(parsed.password ? { password: decodeURIComponent(parsed.password) } : {}),
      ...(isTls ? { tls: {} } : {}),
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      connectTimeout: 10_000,
      retryStrategy,
    } as ConnectionOptions;
  } catch {
    connectionLogger.warn('Could not parse REDIS_URL, using defaults');
    return {
      host: '127.0.0.1',
      port: 6379,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      connectTimeout: 10_000,
      retryStrategy,
    } as ConnectionOptions;
  }
}

export async function closeRedisConnection(): Promise<void> {
  connectionLogger.info('Redis cleanup: handled by BullMQ workers via worker.close()');
}
