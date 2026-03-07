import { type NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { generatedContent, contentIdeas } from '@/db/schema';
import { getContentGenerationQueue } from '@/lib/queue/queues';
import { logger } from '@/lib/logger';
import { apiError, handleApiError } from '@/lib/utils/api-error';
import type { ContentGenerationJobType } from '@/lib/queue/queues';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const TYPE_TO_JOB: Record<string, ContentGenerationJobType> = {
  image: 'generate_image',
  video: 'generate_video',
  blog_article: 'generate_text',
  social_copy: 'generate_text',
  carousel: 'generate_image',
};

export async function POST(_req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const routeLogger = logger.child({ route: 'POST /api/content/[id]/regenerate' });

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Authentication required');
    }
    const userId = session.user.id;
    const { id } = await params;

    const content = await db.query.generatedContent.findFirst({
      where: and(eq(generatedContent.id, id), eq(generatedContent.userId, userId)),
      columns: { id: true, type: true, contentIdeaId: true },
    });

    if (!content) {
      return apiError('NOT_FOUND', 'Generated content not found');
    }

    const idea = await db.query.contentIdeas.findFirst({
      where: eq(contentIdeas.id, content.contentIdeaId),
      columns: { id: true, platform: true, contentType: true },
    });

    if (!idea) {
      return apiError('NOT_FOUND', 'Content idea not found');
    }

    const jobType = TYPE_TO_JOB[content.type] ?? 'generate_text';

    const queue = getContentGenerationQueue();
    const job = await queue.add(
      `regenerate-content-${id}`,
      {
        topicId: idea.id,
        userId,
        contentIdeaId: content.contentIdeaId,
        platform: idea.platform,
        contentType: idea.contentType,
        jobType,
        generatedContentId: id,
      },
      {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
      }
    );

    routeLogger.info({ userId, contentId: id, jobType, jobId: job.id }, 'Regeneration queued');
    return NextResponse.json({
      data: { jobId: job.id, message: 'Regeneration queued' },
    });
  } catch (error) {
    return handleApiError(error, routeLogger);
  }
}
