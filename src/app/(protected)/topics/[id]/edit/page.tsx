import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { topics } from '@/db/schema';
import { TopicForm } from '@/components/features/topics/TopicForm';

export const metadata: Metadata = {
  title: 'Edit Topic',
};

interface EditTopicPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditTopicPage({ params }: EditTopicPageProps) {
  const { id } = await params;
  const session = await auth();
  const userId = session!.user!.id!;

  const topic = await db.query.topics.findFirst({
    where: and(eq(topics.id, id), eq(topics.userId, userId)),
    with: { sources: true },
  });

  if (!topic) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <Link
          href={`/topics/${id}`}
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Topic
        </Link>
        <h1 className="text-2xl font-bold">Edit Topic</h1>
        <p className="text-muted-foreground mt-1 text-sm">Update your topic configuration</p>
      </div>

      <TopicForm topic={topic} />
    </div>
  );
}
