import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { contentIdeas, generatedContent, users } from '@/db/schema';
import { logger } from '@/lib/logger';
import { orchestrateImageGeneration } from '@/lib/ai/image-generator';
import { orchestrateVideoGeneration } from '@/lib/ai/video-generator';
import { generateSocialCopy, generateBlogArticle, generateThread } from '@/lib/ai/text-generator';
import type { ContentGenerationJobData } from '@/lib/queue/queues';
import type { StyleProfile } from '@/types';
import type { ContentIdeaPlatform, GeneratedContentType } from '@/db/schema';

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export interface ContentGenerationResult {
  contentIdeaId: string;
  generatedIds: string[];
  totalCost: number;
  errors: string[];
}

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

async function getUserStyleProfile(userId: string): Promise<StyleProfile | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { styleProfile: true },
  });
  return (user?.styleProfile as StyleProfile | null) ?? null;
}

async function createPendingRecord(
  contentIdeaId: string,
  userId: string,
  type: GeneratedContentType,
  existingId?: string
): Promise<string> {
  if (existingId) {
    // Update existing record back to pending/generating
    await db
      .update(generatedContent)
      .set({ status: 'generating', updatedAt: new Date() })
      .where(and(eq(generatedContent.id, existingId), eq(generatedContent.userId, userId)));
    return existingId;
  }

  const [record] = await db
    .insert(generatedContent)
    .values({
      contentIdeaId,
      userId,
      type,
      status: 'generating',
    })
    .returning({ id: generatedContent.id });

  return record.id;
}

async function markCompleted(
  id: string,
  updates: {
    storageUrl?: string;
    thumbnailUrl?: string;
    content?: string;
    aiToolUsed: string;
    generationCost: string;
    metadata: Record<string, unknown>;
  }
): Promise<void> {
  await db
    .update(generatedContent)
    .set({
      status: 'completed',
      storageUrl: updates.storageUrl ?? null,
      thumbnailUrl: updates.thumbnailUrl ?? null,
      content: updates.content ?? null,
      aiToolUsed: updates.aiToolUsed,
      generationCost: updates.generationCost,
      metadata: updates.metadata,
      updatedAt: new Date(),
    })
    .where(eq(generatedContent.id, id));
}

async function markFailed(id: string, errorMessage: string): Promise<void> {
  await db
    .update(generatedContent)
    .set({
      status: 'failed',
      metadata: { error: errorMessage },
      updatedAt: new Date(),
    })
    .where(eq(generatedContent.id, id));
}

// ─────────────────────────────────────────────────────────
// runContentGeneration
// ─────────────────────────────────────────────────────────

export async function runContentGeneration(
  jobData: ContentGenerationJobData
): Promise<ContentGenerationResult> {
  const { contentIdeaId, userId, jobType } = jobData;

  const genLogger = logger.child({
    fn: 'runContentGeneration',
    contentIdeaId,
    userId,
    jobType,
  });

  genLogger.info('Content generator: starting');

  // Load the content idea
  const idea = await db.query.contentIdeas.findFirst({
    where: and(eq(contentIdeas.id, contentIdeaId), eq(contentIdeas.userId, userId)),
  });

  if (!idea) {
    throw new Error(`Content idea ${contentIdeaId} not found for user ${userId}`);
  }

  const styleProfile = await getUserStyleProfile(userId);
  const platform = idea.platform as ContentIdeaPlatform;

  const result: ContentGenerationResult = {
    contentIdeaId,
    generatedIds: [],
    totalCost: 0,
    errors: [],
  };

  // Determine which types to generate
  const generateImage = jobType === 'generate_image' || jobType === 'generate_all';
  const generateVideo = jobType === 'generate_video' || jobType === 'generate_all';
  const generateText = jobType === 'generate_text' || jobType === 'generate_all';

  // ─── Image Generation ───
  if (generateImage && ['image', 'carousel'].includes(idea.contentType)) {
    const recordId = await createPendingRecord(
      contentIdeaId,
      userId,
      'image',
      jobType === 'generate_image' ? jobData.generatedContentId : undefined
    );

    try {
      const imageResult = await orchestrateImageGeneration({
        contentIdeaId,
        userId,
        visualDirection: idea.visualDirection,
        styleProfile,
        options: {
          aspectRatio: jobData.imageOptions?.aspectRatio ?? getPlatformAspectRatio(platform),
          style: jobData.imageOptions?.style,
        },
        preferDalle: jobData.imageOptions?.preferDalle,
      });

      await markCompleted(recordId, {
        storageUrl: imageResult.storageUrl,
        aiToolUsed: imageResult.aiToolUsed,
        generationCost: imageResult.estimatedCost.toFixed(6),
        metadata: {
          promptUsed: imageResult.promptUsed,
          aspectRatio: jobData.imageOptions?.aspectRatio ?? getPlatformAspectRatio(platform),
          fileSize: imageResult.buffer.length,
        },
      });

      result.generatedIds.push(recordId);
      result.totalCost += imageResult.estimatedCost;
      genLogger.info({ recordId, cost: imageResult.estimatedCost }, 'Image generation complete');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Image generation failed';
      await markFailed(recordId, msg);
      result.errors.push(`Image: ${msg}`);
      genLogger.error({ error }, 'Image generation failed');
    }
  }

  // ─── Video Generation ───
  if (generateVideo && ['video'].includes(idea.contentType)) {
    const recordId = await createPendingRecord(
      contentIdeaId,
      userId,
      'video',
      jobType === 'generate_video' ? jobData.generatedContentId : undefined
    );

    try {
      const videoResult = await orchestrateVideoGeneration({
        contentIdeaId,
        userId,
        visualDirection: idea.visualDirection,
        styleProfile,
        options: {
          duration: jobData.videoOptions?.duration ?? 5,
          aspectRatio: jobData.videoOptions?.aspectRatio ?? getVideoAspectRatio(platform),
        },
      });

      await markCompleted(recordId, {
        storageUrl: videoResult.storageUrl,
        thumbnailUrl: videoResult.thumbnailUrl ?? undefined,
        aiToolUsed: videoResult.aiToolUsed,
        generationCost: videoResult.estimatedCost.toFixed(6),
        metadata: {
          promptUsed: videoResult.promptUsed,
          aspectRatio: jobData.videoOptions?.aspectRatio ?? getVideoAspectRatio(platform),
          duration: jobData.videoOptions?.duration ?? 5,
        },
      });

      result.generatedIds.push(recordId);
      result.totalCost += videoResult.estimatedCost;
      genLogger.info({ recordId, cost: videoResult.estimatedCost }, 'Video generation complete');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Video generation failed';
      await markFailed(recordId, msg);
      result.errors.push(`Video: ${msg}`);
      genLogger.error({ error }, 'Video generation failed');
    }
  }

  // ─── Text/Copy Generation ───
  if (generateText) {
    const isBlog = platform === 'blog';
    const isThread = platform === 'x_thread';
    const contentType: GeneratedContentType = isBlog ? 'blog_article' : 'social_copy';

    const recordId = await createPendingRecord(
      contentIdeaId,
      userId,
      contentType,
      jobType === 'generate_text' ? jobData.generatedContentId : undefined
    );

    try {
      let textContent: string;
      let estimatedCost: number;

      if (isBlog) {
        const blogResult = await generateBlogArticle(idea.title, idea.description, styleProfile, {
          wordCount: jobData.textOptions?.wordCount,
          seoKeywords: jobData.textOptions?.seoKeywords,
        });
        textContent = blogResult.content;
        estimatedCost = blogResult.estimatedCost;
      } else if (isThread) {
        const threadResult = await generateThread(idea.title, idea.description, styleProfile);
        textContent = threadResult.tweets.join('\n\n---\n\n');
        estimatedCost = threadResult.estimatedCost;
      } else {
        const copyResult = await generateSocialCopy(
          idea.title,
          idea.description,
          idea.suggestedCopy,
          styleProfile,
          platform
        );
        textContent = copyResult.content;
        estimatedCost = copyResult.estimatedCost;
      }

      await markCompleted(recordId, {
        content: textContent,
        aiToolUsed: 'claude',
        generationCost: estimatedCost.toFixed(6),
        metadata: {
          platform,
          contentType: isBlog ? 'blog_article' : isThread ? 'thread' : 'social_copy',
          charCount: textContent.length,
        },
      });

      result.generatedIds.push(recordId);
      result.totalCost += estimatedCost;
      genLogger.info({ recordId, cost: estimatedCost }, 'Text generation complete');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Text generation failed';
      await markFailed(recordId, msg);
      result.errors.push(`Text: ${msg}`);
      genLogger.error({ error }, 'Text generation failed');
    }
  }

  genLogger.info(
    {
      generatedIds: result.generatedIds.length,
      totalCost: result.totalCost,
      errors: result.errors.length,
    },
    'Content generator: complete'
  );

  return result;
}

// ─────────────────────────────────────────────────────────
// Platform aspect ratio helpers
// ─────────────────────────────────────────────────────────

function getPlatformAspectRatio(platform: ContentIdeaPlatform): '1:1' | '9:16' | '16:9' | '4:5' {
  switch (platform) {
    case 'instagram_reel':
    case 'tiktok':
    case 'youtube_short':
      return '9:16';
    case 'instagram_post':
      return '4:5';
    case 'blog':
      return '16:9';
    default:
      return '1:1';
  }
}

function getVideoAspectRatio(platform: ContentIdeaPlatform): '16:9' | '9:16' | '1:1' {
  switch (platform) {
    case 'instagram_reel':
    case 'tiktok':
    case 'youtube_short':
      return '9:16';
    case 'blog':
      return '16:9';
    default:
      return '1:1';
  }
}
