import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { contentIdeas, generatedContent } from '@/db/schema';
import { ContentReviewClient } from '@/components/features/content/ContentReviewClient';

export const metadata: Metadata = { title: 'Review Content' };

interface PageProps {
  params: Promise<{ ideaId: string }>;
}

export default async function ContentReviewPage({ params }: PageProps) {
  const { ideaId } = await params;
  const session = await auth();
  const userId = session!.user!.id!;

  const idea = await db.query.contentIdeas.findFirst({
    where: and(eq(contentIdeas.id, ideaId), eq(contentIdeas.userId, userId)),
    columns: {
      id: true,
      title: true,
      platform: true,
      contentType: true,
      status: true,
    },
  });

  if (!idea) {
    notFound();
  }

  const contents = await db
    .select()
    .from(generatedContent)
    .where(and(eq(generatedContent.contentIdeaId, ideaId), eq(generatedContent.userId, userId)));

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <Link
          href={`/content/studio/${ideaId}`}
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Studio
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-bold md:text-2xl">Review Content</h1>
        <p className="text-muted-foreground mt-1 text-sm">{idea.title}</p>
      </div>

      <ContentReviewClient idea={idea} initialContent={contents} />
    </div>
  );
}
