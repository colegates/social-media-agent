import { RateLimiterMemory } from 'rate-limiter-flexible';

// Auth endpoints: 5 requests per minute
export const authRateLimiter = new RateLimiterMemory({
  points: 5,
  duration: 60,
  blockDuration: 60,
});

// General API endpoints: 60 requests per minute
export const apiRateLimiter = new RateLimiterMemory({
  points: 60,
  duration: 60,
  blockDuration: 60,
});

export async function checkRateLimit(
  limiter: RateLimiterMemory,
  key: string
): Promise<{ allowed: boolean; remainingPoints?: number; msBeforeNext?: number }> {
  try {
    const result = await limiter.consume(key);
    return {
      allowed: true,
      remainingPoints: result.remainingPoints,
      msBeforeNext: result.msBeforeNext,
    };
  } catch {
    return { allowed: false };
  }
}
