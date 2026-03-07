import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { eq, and, desc } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { topics, trends } from '@/db/schema';
import { logger } from '@/lib/logger';
import { apiError, handleApiError } from '@/lib/utils/api-error';
import { generateIdeasSchema } from '@/lib/validators/ideas';
import { getContentIdeasQueue } from '@/lib/queue/queues';

const routeLogger = logger.child({ route: 'POST /api/ideas/generate' });

export async function POST(req: NextRequest): Promise<NextResponse> {
  const start = Date.now();

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'You must be logged in');
    }
    const userId = session.user.id;

    const body = await req.json();
    const parsed = generateIdeasSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid request body', parsed.error.flatten());
    }

    const { topicId, trendIds: providedTrendIds } = parsed.data;

    // Verify topic ownership
    const topic = await db.query.topics.findFirst({
      where: and(eq(topics.id, topicId), eq(topics.userId, userId)),
      columns: { id: true, name: true },
    });

    if (!topic) {
      return apiError('NOT_FOUND', 'Topic not found');
    }

    // If no trend IDs provided, get the most recent high-scoring trends
    let trendIds = providedTrendIds ?? [];
    if (trendIds.length === 0) {
      const recentTrends = await db
        .select({ id: trends.id })
        .from(trends)
        .where(eq(trends.topicId, topicId))
        .orderBy(desc(trends.viralityScore))
        .limit(10);

      trendIds = recentTrends.map((t) => t.id);

      if (trendIds.length === 0) {
        return apiError('VALIDATION_ERROR', 'No trends found for this topic. Run a scan first.');
      }
    }

    // Enqueue the job
    const queue = getContentIdeasQueue();
    const job = await queue.add('generate-ideas', {
      topicId,
      userId,
      trendIds,
    });

    routeLogger.info(
      { userId, topicId, trendCount: trendIds.length, jobId: job.id, duration: Date.now() - start },
      'Content idea generation queued'
    );

    return NextResponse.json(
      { success: true, jobId: job.id, message: `Generating ideas for ${trendIds.length} trends` },
      { status: 202 }
    );
  } catch (error) {
    return handleApiError(error, routeLogger);
  }
}
