import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { topics } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { runFullPipeline } from '@/lib/automation/pipeline';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ topicId: string }> }
): Promise<NextResponse> {
  const { topicId } = await params;
  const routeLogger = logger.child({ route: 'POST /api/automation/pipeline/[topicId]/run', topicId });

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    // Verify topic ownership
    const [topic] = await db
      .select({ id: topics.id, name: topics.name })
      .from(topics)
      .where(and(eq(topics.id, topicId), eq(topics.userId, session.user.id)))
      .limit(1);

    if (!topic) {
      return NextResponse.json({ error: 'Topic not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    // Fire pipeline asynchronously so this request returns immediately
    setImmediate(() => {
      runFullPipeline({ topicId, userId: session.user.id }).catch((err) => {
        routeLogger.error({ err, topicId }, 'Pipeline run failed');
      });
    });

    routeLogger.info({ userId: session.user.id, topicId }, 'Pipeline triggered manually');
    return NextResponse.json({ data: { topicId, status: 'started' } });
  } catch (error) {
    routeLogger.error({ error }, 'Failed to trigger pipeline');
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
