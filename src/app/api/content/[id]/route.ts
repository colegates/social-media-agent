import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { generatedContent } from '@/db/schema';
import { logger } from '@/lib/logger';
import { apiError, handleApiError } from '@/lib/utils/api-error';
import { deleteFile, extractKeyFromUrl } from '@/lib/storage/r2';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ─── GET /api/content/[id] ───

export async function GET(_req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const routeLogger = logger.child({ route: 'GET /api/content/[id]' });

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Authentication required');
    }
    const userId = session.user.id;
    const { id } = await params;

    const content = await db.query.generatedContent.findFirst({
      where: and(eq(generatedContent.id, id), eq(generatedContent.userId, userId)),
    });

    if (!content) {
      return apiError('NOT_FOUND', 'Generated content not found');
    }

    routeLogger.info({ userId, contentId: id }, 'Content fetched');
    return NextResponse.json({ data: content });
  } catch (error) {
    return handleApiError(error, routeLogger);
  }
}

// ─── PUT /api/content/[id] ───

const updateSchema = z.object({
  content: z.string().optional(),
  status: z.enum(['approved', 'published']).optional(),
});

export async function PUT(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const routeLogger = logger.child({ route: 'PUT /api/content/[id]' });

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Authentication required');
    }
    const userId = session.user.id;
    const { id } = await params;

    const body: unknown = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', parsed.error.flatten());
    }

    const existing = await db.query.generatedContent.findFirst({
      where: and(eq(generatedContent.id, id), eq(generatedContent.userId, userId)),
      columns: { id: true },
    });

    if (!existing) {
      return apiError('NOT_FOUND', 'Generated content not found');
    }

    const [updated] = await db
      .update(generatedContent)
      .set({
        ...parsed.data,
        updatedAt: new Date(),
      })
      .where(and(eq(generatedContent.id, id), eq(generatedContent.userId, userId)))
      .returning();

    routeLogger.info({ userId, contentId: id }, 'Content updated');
    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleApiError(error, routeLogger);
  }
}

// ─── DELETE /api/content/[id] ───

export async function DELETE(_req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const routeLogger = logger.child({ route: 'DELETE /api/content/[id]' });

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Authentication required');
    }
    const userId = session.user.id;
    const { id } = await params;

    const existing = await db.query.generatedContent.findFirst({
      where: and(eq(generatedContent.id, id), eq(generatedContent.userId, userId)),
      columns: { id: true, storageUrl: true },
    });

    if (!existing) {
      return apiError('NOT_FOUND', 'Generated content not found');
    }

    // Delete from R2 if asset exists
    if (existing.storageUrl && process.env.R2_PUBLIC_URL) {
      try {
        const key = extractKeyFromUrl(existing.storageUrl);
        await deleteFile(key);
      } catch (r2Error) {
        routeLogger.warn({ r2Error }, 'Failed to delete R2 asset - continuing with DB delete');
      }
    }

    await db
      .delete(generatedContent)
      .where(and(eq(generatedContent.id, id), eq(generatedContent.userId, userId)));

    routeLogger.info({ userId, contentId: id }, 'Content deleted');
    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    return handleApiError(error, routeLogger);
  }
}
