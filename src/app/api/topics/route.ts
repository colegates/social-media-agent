import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { eq, and, desc } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { topics } from '@/db/schema';
import { logger } from '@/lib/logger';
import { apiError, handleApiError } from '@/lib/utils/api-error';
import { createTopicSchema } from '@/lib/validators/topics';

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const routeLogger = logger.child({ route: 'GET /api/topics' });
  const start = Date.now();

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'You must be logged in to view topics');
    }

    const userTopics = await db.query.topics.findMany({
      where: and(eq(topics.userId, session.user.id), eq(topics.isActive, true)),
      with: { sources: true },
      orderBy: [desc(topics.createdAt)],
    });

    routeLogger.info(
      { userId: session.user.id, count: userTopics.length, duration: Date.now() - start },
      'Topics listed'
    );

    return NextResponse.json({ data: userTopics });
  } catch (error) {
    return handleApiError(error, routeLogger);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const routeLogger = logger.child({ route: 'POST /api/topics' });
  const start = Date.now();

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'You must be logged in to create a topic');
    }

    const body: unknown = await req.json();
    const parsed = createTopicSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', parsed.error.flatten());
    }

    const { name, description, keywords, scanFrequencyMinutes, isActive } = parsed.data;

    const [newTopic] = await db
      .insert(topics)
      .values({
        userId: session.user.id,
        name,
        description: description ?? null,
        keywords,
        scanFrequencyMinutes,
        isActive: isActive ?? true,
      })
      .returning();

    routeLogger.info(
      { userId: session.user.id, topicId: newTopic.id, duration: Date.now() - start },
      'Topic created'
    );

    return NextResponse.json({ data: newTopic }, { status: 201 });
  } catch (error) {
    return handleApiError(error, routeLogger);
  }
}
