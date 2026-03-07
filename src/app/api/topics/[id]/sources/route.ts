import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { topics, topicSources } from '@/db/schema';
import { logger } from '@/lib/logger';
import { apiError, handleApiError } from '@/lib/utils/api-error';
import { createSourceSchema } from '@/lib/validators/topics';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  const routeLogger = logger.child({ route: 'POST /api/topics/[id]/sources', topicId: id });
  const start = Date.now();

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'You must be logged in');
    }

    // Verify the topic belongs to this user
    const topic = await db.query.topics.findFirst({
      where: and(eq(topics.id, id), eq(topics.userId, session.user.id)),
    });
    if (!topic) {
      return apiError('NOT_FOUND', 'Topic not found');
    }

    const body: unknown = await req.json();
    const parsed = createSourceSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', parsed.error.flatten());
    }

    const { type, value, label, metadata } = parsed.data;

    const [newSource] = await db
      .insert(topicSources)
      .values({
        topicId: id,
        type,
        value,
        label: label ?? null,
        metadata: metadata ?? {},
      })
      .returning();

    routeLogger.info(
      { userId: session.user.id, topicId: id, sourceId: newSource.id, duration: Date.now() - start },
      'Topic source added'
    );

    return NextResponse.json({ data: newSource }, { status: 201 });
  } catch (error) {
    return handleApiError(error, routeLogger);
  }
}
