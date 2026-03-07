import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { TopicForm } from '@/components/features/topics/TopicForm';

export const metadata: Metadata = {
  title: 'New Topic',
};

export default function NewTopicPage() {
  return (
    <div className="mx-auto max-w-2xl p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <Link
          href="/topics"
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Topics
        </Link>
        <h1 className="text-2xl font-bold">New Topic</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Configure a topic to start monitoring trends
        </p>
      </div>

      <TopicForm />
    </div>
  );
}
