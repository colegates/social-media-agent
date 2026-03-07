import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { styleExamples } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { apiError, handleApiError } from '@/lib/utils/api-error';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const routeLogger = logger.child({ route: 'DELETE /api/style/examples/[id]', exampleId: id });

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Authentication required');
    }

    const deleted = await db
      .delete(styleExamples)
      .where(and(eq(styleExamples.id, id), eq(styleExamples.userId, session.user.id)))
      .returning({ id: styleExamples.id });

    if (deleted.length === 0) {
      return apiError('NOT_FOUND', 'Style example not found');
    }

    routeLogger.info({ userId: session.user.id }, 'Style example deleted');
    return NextResponse.json({ data: { id } });
  } catch (error) {
    return handleApiError(error, routeLogger);
  }
}
