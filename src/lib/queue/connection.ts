import type { ConnectionOptions } from 'bullmq';
import { logger } from '@/lib/logger';

const connectionLogger = logger.child({ module: 'redis' });

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
    } as ConnectionOptions;
  } catch {
    connectionLogger.warn('Could not parse REDIS_URL, using defaults');
    return {
      host: '127.0.0.1',
      port: 6379,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      connectTimeout: 10_000,
    } as ConnectionOptions;
  }
}

export async function closeRedisConnection(): Promise<void> {
  connectionLogger.info('Redis cleanup: handled by BullMQ workers via worker.close()');
}
