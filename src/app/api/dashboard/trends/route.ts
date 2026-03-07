import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { topics, trends } from '@/db/schema';
import { logger } from '@/lib/logger';
import { apiError, handleApiError } from '@/lib/utils/api-error';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  platform: z.enum(['google', 'tiktok', 'instagram', 'x', 'reddit', 'youtube', 'web']).optional(),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const routeLogger = logger.child({ route: 'GET /api/dashboard/trends' });
  const start = Date.now();

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'You must be logged in');
    }

    const searchParams = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = querySchema.safeParse(searchParams);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid query parameters', parsed.error.flatten());
    }

    const { limit, platform } = parsed.data;

    // Get all active topic IDs for this user
    const userTopics = await db
      .select({ id: topics.id, name: topics.name })
      .from(topics)
      .where(and(eq(topics.userId, session.user.id), eq(topics.isActive, true)));

    if (userTopics.length === 0) {
      return NextResponse.json({ data: [], topicSummaries: [] });
    }

    const topicIds = userTopics.map((t) => t.id);

    const conditions = [inArray(trends.topicId, topicIds)];
    if (platform) {
      conditions.push(eq(trends.platform, platform));
    }

    // Get top trends across all topics
    const topTrends = await db
      .select({
        id: trends.id,
        topicId: trends.topicId,
        title: trends.title,
        description: trends.description,
        sourceUrl: trends.sourceUrl,
        platform: trends.platform,
        viralityScore: trends.viralityScore,
        engagementData: trends.engagementData,
        discoveredAt: trends.discoveredAt,
        expiresAt: trends.expiresAt,
      })
      .from(trends)
      .where(and(...conditions))
      .orderBy(desc(trends.viralityScore))
      .limit(limit);

    // Build topic name lookup
    const topicNameMap = new Map(userTopics.map((t) => [t.id, t.name]));

    const trendsWithTopicName = topTrends.map((trend) => ({
      ...trend,
      topicName: topicNameMap.get(trend.topicId) ?? 'Unknown Topic',
    }));

    routeLogger.info(
      { userId: session.user.id, trendsCount: topTrends.length, duration: Date.now() - start },
      'Dashboard trends fetched'
    );

    return NextResponse.json({
      data: trendsWithTopicName,
    });
  } catch (error) {
    return handleApiError(error, routeLogger);
  }
}
