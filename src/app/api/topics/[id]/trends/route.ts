import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { eq, and, desc, asc } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { topics, trends } from '@/db/schema';
import { logger } from '@/lib/logger';
import { apiError, handleApiError } from '@/lib/utils/api-error';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['viralityScore', 'discoveredAt']).default('viralityScore'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  platform: z.enum(['google', 'tiktok', 'instagram', 'x', 'reddit', 'youtube', 'web']).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id: topicId } = await params;
  const routeLogger = logger.child({ route: 'GET /api/topics/[id]/trends', topicId });
  const start = Date.now();

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'You must be logged in');
    }

    // Verify topic belongs to user
    const topic = await db.query.topics.findFirst({
      where: and(eq(topics.id, topicId), eq(topics.userId, session.user.id)),
      columns: { id: true },
    });

    if (!topic) {
      return apiError('NOT_FOUND', 'Topic not found');
    }

    const searchParams = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = querySchema.safeParse(searchParams);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid query parameters', parsed.error.flatten());
    }

    const { page, limit, sortBy, sortOrder, platform } = parsed.data;
    const offset = (page - 1) * limit;

    const conditions = [eq(trends.topicId, topicId)];
    if (platform) {
      conditions.push(eq(trends.platform, platform));
    }

    const orderFn = sortOrder === 'asc' ? asc : desc;
    const orderCol = sortBy === 'viralityScore' ? trends.viralityScore : trends.discoveredAt;

    const [results, countResult] = await Promise.all([
      db
        .select({
          id: trends.id,
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
        .orderBy(orderFn(orderCol))
        .limit(limit)
        .offset(offset),
      db
        .select({ id: trends.id })
        .from(trends)
        .where(and(...conditions)),
    ]);

    routeLogger.info(
      { userId: session.user.id, topicId, count: results.length, duration: Date.now() - start },
      'Trends listed'
    );

    return NextResponse.json({
      data: results,
      pagination: {
        page,
        limit,
        total: countResult.length,
        totalPages: Math.ceil(countResult.length / limit),
      },
    });
  } catch (error) {
    return handleApiError(error, routeLogger);
  }
}
