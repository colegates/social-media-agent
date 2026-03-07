import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { contentIdeas } from '@/db/schema';
import { logger } from '@/lib/logger';
import { apiError, handleApiError } from '@/lib/utils/api-error';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  const routeLogger = logger.child({ route: 'POST /api/ideas/[id]/approve', ideaId: id });
  const start = Date.now();

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'You must be logged in');
    }

    const [updated] = await db
      .update(contentIdeas)
      .set({ status: 'approved', updatedAt: new Date() })
      .where(and(eq(contentIdeas.id, id), eq(contentIdeas.userId, session.user.id)))
      .returning({ id: contentIdeas.id, status: contentIdeas.status });

    if (!updated) {
      return apiError('NOT_FOUND', 'Content idea not found');
    }

    routeLogger.info({ userId: session.user.id, duration: Date.now() - start }, 'Idea approved');

    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleApiError(error, routeLogger);
  }
}
