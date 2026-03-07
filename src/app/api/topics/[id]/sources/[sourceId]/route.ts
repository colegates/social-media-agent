import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { topics, topicSources } from '@/db/schema';
import { logger } from '@/lib/logger';
import { apiError, handleApiError } from '@/lib/utils/api-error';

type RouteParams = { params: Promise<{ id: string; sourceId: string }> };

export async function DELETE(
  _req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const { id, sourceId } = await params;
  const routeLogger = logger.child({
    route: 'DELETE /api/topics/[id]/sources/[sourceId]',
    topicId: id,
    sourceId,
  });
  const start = Date.now();

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'You must be logged in');
    }

    // Verify topic ownership
    const topic = await db.query.topics.findFirst({
      where: and(eq(topics.id, id), eq(topics.userId, session.user.id)),
    });
    if (!topic) {
      return apiError('NOT_FOUND', 'Topic not found');
    }

    // Verify source belongs to this topic
    const source = await db.query.topicSources.findFirst({
      where: and(eq(topicSources.id, sourceId), eq(topicSources.topicId, id)),
    });
    if (!source) {
      return apiError('NOT_FOUND', 'Source not found');
    }

    await db.delete(topicSources).where(eq(topicSources.id, sourceId));

    routeLogger.info(
      { userId: session.user.id, topicId: id, sourceId, duration: Date.now() - start },
      'Topic source deleted'
    );

    return NextResponse.json({ data: { id: sourceId, deleted: true } });
  } catch (error) {
    return handleApiError(error, routeLogger);
  }
}
