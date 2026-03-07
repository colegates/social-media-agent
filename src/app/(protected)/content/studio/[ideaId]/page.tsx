import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { contentIdeas, generatedContent } from '@/db/schema';
import { ContentStudioClient } from '@/components/features/content/ContentStudioClient';

export const metadata: Metadata = { title: 'Content Studio' };

interface PageProps {
  params: Promise<{ ideaId: string }>;
}

export default async function ContentStudioPage({ params }: PageProps) {
  const { ideaId } = await params;
  const session = await auth();
  const userId = session!.user!.id!;

  const idea = await db.query.contentIdeas.findFirst({
    where: and(eq(contentIdeas.id, ideaId), eq(contentIdeas.userId, userId)),
    with: {
      topic: { columns: { id: true, name: true } },
    },
  });

  if (!idea) {
    notFound();
  }

  const existingContent = await db
    .select()
    .from(generatedContent)
    .where(and(eq(generatedContent.contentIdeaId, ideaId), eq(generatedContent.userId, userId)));

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <Link
          href={`/content/ideas/${ideaId}`}
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Idea
        </Link>
      </div>

      <ContentStudioClient idea={idea} existingContent={existingContent} />
    </div>
  );
}
