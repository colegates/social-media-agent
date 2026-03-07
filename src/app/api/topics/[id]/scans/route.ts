import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { topics, scanJobs } from '@/db/schema';
import { logger } from '@/lib/logger';
import { apiError, handleApiError } from '@/lib/utils/api-error';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id: topicId } = await params;
  const routeLogger = logger.child({ route: 'GET /api/topics/[id]/scans', topicId });
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

    const { page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    const [results, countResult] = await Promise.all([
      db
        .select({
          id: scanJobs.id,
          status: scanJobs.status,
          trendsFound: scanJobs.trendsFound,
          startedAt: scanJobs.startedAt,
          completedAt: scanJobs.completedAt,
          errorLog: scanJobs.errorLog,
          metadata: scanJobs.metadata,
        })
        .from(scanJobs)
        .where(eq(scanJobs.topicId, topicId))
        .orderBy(desc(scanJobs.startedAt))
        .limit(limit)
        .offset(offset),
      db.select({ id: scanJobs.id }).from(scanJobs).where(eq(scanJobs.topicId, topicId)),
    ]);

    routeLogger.info(
      { userId: session.user.id, topicId, count: results.length, duration: Date.now() - start },
      'Scan history listed'
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
