import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { contentIdeas } from '@/db/schema';
import { getContentGenerationQueue } from '@/lib/queue/queues';
import { logger } from '@/lib/logger';
import { apiError, handleApiError } from '@/lib/utils/api-error';

const generateSchema = z.object({
  ideaId: z.string().uuid(),
  types: z
    .array(z.enum(['image', 'video', 'social_copy', 'blog_article']))
    .min(1, 'At least one content type required'),
  imageOptions: z
    .object({
      aspectRatio: z.enum(['1:1', '9:16', '16:9', '4:5']).optional(),
      style: z.string().optional(),
      preferDalle: z.boolean().optional(),
    })
    .optional(),
  videoOptions: z
    .object({
      duration: z.union([z.literal(5), z.literal(10)]).optional(),
      aspectRatio: z.enum(['16:9', '9:16', '1:1']).optional(),
    })
    .optional(),
  textOptions: z
    .object({
      seoKeywords: z.array(z.string()).optional(),
      wordCount: z.number().int().min(200).max(5000).optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const routeLogger = logger.child({ route: 'POST /api/content/generate' });
  const start = Date.now();

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Authentication required');
    }
    const userId = session.user.id;

    const body: unknown = await req.json();
    const parsed = generateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', parsed.error.flatten());
    }

    const { ideaId, types, imageOptions, videoOptions, textOptions } = parsed.data;

    // Verify the idea belongs to the user
    const idea = await db.query.contentIdeas.findFirst({
      where: and(eq(contentIdeas.id, ideaId), eq(contentIdeas.userId, userId)),
      columns: { id: true, platform: true, contentType: true, title: true },
    });

    if (!idea) {
      return apiError('NOT_FOUND', 'Content idea not found');
    }

    // Determine job type
    const hasImage = types.includes('image');
    const hasVideo = types.includes('video');
    const hasText = types.includes('social_copy') || types.includes('blog_article');

    let jobType: 'generate_image' | 'generate_video' | 'generate_text' | 'generate_all';
    if (hasImage && hasVideo && hasText) {
      jobType = 'generate_all';
    } else if (hasImage && hasText) {
      jobType = 'generate_all';
    } else if (hasVideo && hasText) {
      jobType = 'generate_all';
    } else if (hasImage) {
      jobType = 'generate_image';
    } else if (hasVideo) {
      jobType = 'generate_video';
    } else {
      jobType = 'generate_text';
    }

    // Queue the job
    const queue = getContentGenerationQueue();
    const job = await queue.add(
      `generate-content-${ideaId}`,
      {
        topicId: idea.id, // Using ideaId as reference
        userId,
        contentIdeaId: ideaId,
        platform: idea.platform,
        contentType: idea.contentType,
        jobType,
        imageOptions,
        videoOptions,
        textOptions,
      },
      {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
      }
    );

    const duration = Date.now() - start;
    routeLogger.info(
      { userId, ideaId, jobType, jobId: job.id, duration },
      'Content generation queued'
    );

    return NextResponse.json({
      data: {
        jobId: job.id,
        ideaId,
        jobType,
        message: 'Content generation queued. Use SSE to track progress.',
      },
    });
  } catch (error) {
    return handleApiError(error, routeLogger);
  }
}
