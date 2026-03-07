import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { eq, and, desc, asc, gte, lte, inArray, count } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { contentIdeas, topics } from '@/db/schema';
import { logger } from '@/lib/logger';
import { apiError, handleApiError } from '@/lib/utils/api-error';
import { listIdeasQuerySchema } from '@/lib/validators/ideas';

const routeLogger = logger.child({ route: 'GET /api/ideas' });

export async function GET(req: NextRequest): Promise<NextResponse> {
  const start = Date.now();

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'You must be logged in');
    }
    const userId = session.user.id;

    const searchParams = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = listIdeasQuerySchema.safeParse(searchParams);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid query parameters', parsed.error.flatten());
    }

    const {
      page,
      limit,
      topicId,
      platform,
      contentType,
      status,
      sortBy,
      sortOrder,
      fromDate,
      toDate,
    } = parsed.data;
    const offset = (page - 1) * limit;

    // Build conditions
    const conditions = [eq(contentIdeas.userId, userId)];

    if (topicId) {
      // Verify topic ownership
      const topic = await db.query.topics.findFirst({
        where: and(eq(topics.id, topicId), eq(topics.userId, userId)),
        columns: { id: true },
      });
      if (!topic) {
        return apiError('NOT_FOUND', 'Topic not found');
      }
      conditions.push(eq(contentIdeas.topicId, topicId));
    }

    if (platform) conditions.push(eq(contentIdeas.platform, platform));
    if (contentType) conditions.push(eq(contentIdeas.contentType, contentType));
    if (status) conditions.push(eq(contentIdeas.status, status));
    if (fromDate) conditions.push(gte(contentIdeas.createdAt, fromDate));
    if (toDate) conditions.push(lte(contentIdeas.createdAt, toDate));

    const orderFn = sortOrder === 'asc' ? asc : desc;
    const orderCol =
      sortBy === 'createdAt'
        ? contentIdeas.createdAt
        : sortBy === 'scheduledFor'
          ? contentIdeas.scheduledFor
          : contentIdeas.priorityScore;

    const [results, [totalRow]] = await Promise.all([
      db
        .select({
          id: contentIdeas.id,
          topicId: contentIdeas.topicId,
          trendId: contentIdeas.trendId,
          title: contentIdeas.title,
          description: contentIdeas.description,
          platform: contentIdeas.platform,
          contentType: contentIdeas.contentType,
          suggestedCopy: contentIdeas.suggestedCopy,
          priorityScore: contentIdeas.priorityScore,
          status: contentIdeas.status,
          scheduledFor: contentIdeas.scheduledFor,
          createdAt: contentIdeas.createdAt,
        })
        .from(contentIdeas)
        .where(and(...conditions))
        .orderBy(orderFn(orderCol))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(contentIdeas)
        .where(and(...conditions)),
    ]);

    routeLogger.info(
      { userId, count: results.length, duration: Date.now() - start },
      'Ideas listed'
    );

    return NextResponse.json({
      data: results,
      pagination: {
        page,
        limit,
        total: totalRow?.total ?? 0,
        totalPages: Math.ceil((totalRow?.total ?? 0) / limit),
      },
    });
  } catch (error) {
    return handleApiError(error, routeLogger);
  }
}

// Bulk status update (not in spec but useful for swipe actions)
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const patchLogger = logger.child({ route: 'PATCH /api/ideas' });
  const start = Date.now();

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'You must be logged in');
    }
    const userId = session.user.id;

    const body = (await req.json()) as unknown;
    const schema = z.object({
      ids: z.array(z.string().uuid()).min(1).max(50),
      status: z.enum(['approved', 'rejected']),
    });

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid request body', parsed.error.flatten());
    }

    const { ids, status } = parsed.data as { ids: string[]; status: 'approved' | 'rejected' };

    await db
      .update(contentIdeas)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(contentIdeas.userId, userId), inArray(contentIdeas.id, ids)));

    patchLogger.info(
      { userId, ids: ids.length, status, duration: Date.now() - start },
      'Bulk status updated'
    );

    return NextResponse.json({ success: true, updated: ids.length });
  } catch (error) {
    return handleApiError(error, patchLogger);
  }
}
