import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { contentIdeas } from '@/db/schema';
import { logger } from '@/lib/logger';
import { apiError, handleApiError } from '@/lib/utils/api-error';
import { updateIdeaSchema } from '@/lib/validators/ideas';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  const routeLogger = logger.child({ route: 'GET /api/ideas/[id]', ideaId: id });
  const start = Date.now();

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'You must be logged in');
    }

    const idea = await db.query.contentIdeas.findFirst({
      where: and(eq(contentIdeas.id, id), eq(contentIdeas.userId, session.user.id)),
      with: {
        topic: { columns: { id: true, name: true } },
        trend: {
          columns: {
            id: true,
            title: true,
            sourceUrl: true,
            platform: true,
            viralityScore: true,
            discoveredAt: true,
          },
        },
      },
    });

    if (!idea) {
      return apiError('NOT_FOUND', 'Content idea not found');
    }

    routeLogger.info({ userId: session.user.id, duration: Date.now() - start }, 'Idea fetched');

    return NextResponse.json({ data: idea });
  } catch (error) {
    return handleApiError(error, routeLogger);
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  const routeLogger = logger.child({ route: 'PUT /api/ideas/[id]', ideaId: id });
  const start = Date.now();

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'You must be logged in');
    }

    // Verify ownership
    const existing = await db.query.contentIdeas.findFirst({
      where: and(eq(contentIdeas.id, id), eq(contentIdeas.userId, session.user.id)),
      columns: { id: true },
    });

    if (!existing) {
      return apiError('NOT_FOUND', 'Content idea not found');
    }

    const body = await req.json();
    const parsed = updateIdeaSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid request body', parsed.error.flatten());
    }

    const updates = parsed.data;
    if (Object.keys(updates).length === 0) {
      return apiError('VALIDATION_ERROR', 'No fields to update');
    }

    const [updated] = await db
      .update(contentIdeas)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(contentIdeas.id, id), eq(contentIdeas.userId, session.user.id)))
      .returning();

    routeLogger.info({ userId: session.user.id, duration: Date.now() - start }, 'Idea updated');

    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleApiError(error, routeLogger);
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  const routeLogger = logger.child({ route: 'DELETE /api/ideas/[id]', ideaId: id });
  const start = Date.now();

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'You must be logged in');
    }

    const deleted = await db
      .delete(contentIdeas)
      .where(and(eq(contentIdeas.id, id), eq(contentIdeas.userId, session.user.id)))
      .returning({ id: contentIdeas.id });

    if (deleted.length === 0) {
      return apiError('NOT_FOUND', 'Content idea not found');
    }

    routeLogger.info({ userId: session.user.id, duration: Date.now() - start }, 'Idea deleted');

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, routeLogger);
  }
}
