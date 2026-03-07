import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { topics } from '@/db/schema';
import { logger } from '@/lib/logger';
import { apiError, handleApiError } from '@/lib/utils/api-error';
import { triggerImmediateScan } from '@/lib/queue/scheduler';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id: topicId } = await params;
  const routeLogger = logger.child({ route: 'POST /api/topics/[id]/scan', topicId });
  const start = Date.now();

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'You must be logged in');
    }

    // Verify topic belongs to user and is active
    const topic = await db.query.topics.findFirst({
      where: and(eq(topics.id, topicId), eq(topics.userId, session.user.id)),
      columns: { id: true, isActive: true, name: true },
    });

    if (!topic) {
      return apiError('NOT_FOUND', 'Topic not found');
    }

    if (!topic.isActive) {
      return apiError('VALIDATION_ERROR', 'Cannot scan an inactive topic. Activate the topic first.');
    }

    // Check if Redis is configured
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      return apiError(
        'SERVICE_UNAVAILABLE',
        'Background job queue is not configured. Set the REDIS_URL environment variable.'
      );
    }

    const scanJobId = await triggerImmediateScan(topicId, session.user.id);

    routeLogger.info(
      { userId: session.user.id, topicId, scanJobId, duration: Date.now() - start },
      'Manual scan triggered'
    );

    return NextResponse.json(
      { data: { scanJobId, message: 'Scan job queued successfully' } },
      { status: 202 }
    );
  } catch (error) {
    return handleApiError(error, routeLogger);
  }
}
