import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { contentIdeas } from '@/db/schema';
import { IdeaDetailClient } from '@/components/features/ideas/IdeaDetailClient';

export const metadata: Metadata = { title: 'Content Idea' };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function IdeaDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  const userId = session!.user!.id!;

  const idea = await db.query.contentIdeas.findFirst({
    where: and(eq(contentIdeas.id, id), eq(contentIdeas.userId, userId)),
    with: {
      topic: { columns: { id: true, name: true } },
      trend: {
        columns: {
          id: true,
          title: true,
          sourceUrl: true,
          platform: true,
          viralityScore: true,
          discoveredAt: true,
        },
      },
    },
  });

  if (!idea) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-6 lg:p-8">
      <div className="mb-5">
        <Link
          href="/content/ideas"
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Ideas
        </Link>
        {idea.topic && (
          <p className="text-muted-foreground mt-2 text-xs">
            Topic:{' '}
            <Link href={`/topics/${idea.topic.id}`} className="hover:underline">
              {idea.topic.name}
            </Link>
          </p>
        )}
      </div>

      <IdeaDetailClient idea={idea} />
    </div>
  );
}
