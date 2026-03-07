import { type NextRequest, NextResponse } from 'next/server';
import { and, eq, desc } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { contentIdeas, generatedContent } from '@/db/schema';
import { logger } from '@/lib/logger';
import { apiError, handleApiError } from '@/lib/utils/api-error';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const routeLogger = logger.child({ route: 'GET /api/ideas/[id]/content' });

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Authentication required');
    }
    const userId = session.user.id;
    const { id } = await params;

    // Verify the idea belongs to the user
    const idea = await db.query.contentIdeas.findFirst({
      where: and(eq(contentIdeas.id, id), eq(contentIdeas.userId, userId)),
      columns: { id: true },
    });

    if (!idea) {
      return apiError('NOT_FOUND', 'Content idea not found');
    }

    const contents = await db
      .select()
      .from(generatedContent)
      .where(and(eq(generatedContent.contentIdeaId, id), eq(generatedContent.userId, userId)))
      .orderBy(desc(generatedContent.createdAt));

    routeLogger.info({ userId, ideaId: id, count: contents.length }, 'Idea content fetched');
    return NextResponse.json({ data: contents });
  } catch (error) {
    return handleApiError(error, routeLogger);
  }
}
