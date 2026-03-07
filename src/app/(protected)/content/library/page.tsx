import type { Metadata } from 'next';
import { eq, desc } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { generatedContent, contentIdeas } from '@/db/schema';
import { ContentLibraryClient } from '@/components/features/content/ContentLibraryClient';

export const metadata: Metadata = { title: 'Content Library' };

export default async function ContentLibraryPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const contents = await db
    .select({
      id: generatedContent.id,
      contentIdeaId: generatedContent.contentIdeaId,
      userId: generatedContent.userId,
      type: generatedContent.type,
      status: generatedContent.status,
      storageUrl: generatedContent.storageUrl,
      thumbnailUrl: generatedContent.thumbnailUrl,
      content: generatedContent.content,
      metadata: generatedContent.metadata,
      aiToolUsed: generatedContent.aiToolUsed,
      generationCost: generatedContent.generationCost,
      createdAt: generatedContent.createdAt,
      updatedAt: generatedContent.updatedAt,
      ideaTitle: contentIdeas.title,
      ideaPlatform: contentIdeas.platform,
    })
    .from(generatedContent)
    .leftJoin(contentIdeas, eq(generatedContent.contentIdeaId, contentIdeas.id))
    .where(eq(generatedContent.userId, userId))
    .orderBy(desc(generatedContent.createdAt))
    .limit(100);

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Content Library</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          All your generated content in one place
        </p>
      </div>

      <ContentLibraryClient initialContents={contents} />
    </div>
  );
}
