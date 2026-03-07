'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Search, BookMarked } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TopicCard } from './TopicCard';
import type { Topic, TopicSource } from '@/db/schema';

interface TopicsClientProps {
  initialTopics: (Topic & { sources: TopicSource[] })[];
}

export function TopicsClient({ initialTopics }: TopicsClientProps) {
  const [search, setSearch] = useState('');

  const filtered = initialTopics.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description?.toLowerCase().includes(search.toLowerCase()) ||
      t.keywords.some((k) => k.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Topics</h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage your trend monitoring topics</p>
        </div>
        <Link href="/topics/new" className={buttonVariants({ variant: 'default', className: 'hidden sm:flex' })}>
          <Plus className="h-4 w-4" />
          Add Topic
        </Link>
      </div>

      {/* Search */}
      {initialTopics.length > 0 && (
        <div className="relative mb-6">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            type="search"
            placeholder="Search topics..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {/* Topics grid or empty state */}
      {initialTopics.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-4 py-16 text-center">
          <BookMarked className="text-muted-foreground mb-4 h-12 w-12" />
          <h2 className="mb-1 text-lg font-semibold">No topics yet</h2>
          <p className="text-muted-foreground mb-6 max-w-sm text-sm">
            Create your first topic to start monitoring trends across social media platforms.
          </p>
          <Link href="/topics/new" className={buttonVariants()}>
            <Plus className="h-4 w-4" />
            Create your first topic
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border border-dashed px-4 py-12 text-center text-sm">
          No topics match &ldquo;{search}&rdquo;
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((topic) => (
            <TopicCard key={topic.id} topic={topic} />
          ))}
        </div>
      )}

      {/* Mobile FAB */}
      <Link
        href="/topics/new"
        className="bg-primary text-primary-foreground fixed right-4 bottom-20 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-opacity hover:opacity-90 sm:hidden"
        aria-label="Add new topic"
      >
        <Plus className="h-6 w-6" />
      </Link>
    </>
  );
}
