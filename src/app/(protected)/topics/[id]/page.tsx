import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq, and } from 'drizzle-orm';
import {
  ChevronLeft,
  Edit2,
  Globe,
  Link2,
  Hash,
  Search,
  Users,
  MessageSquare,
  Clock,
  Calendar,
  Zap,
} from 'lucide-react';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { topics } from '@/db/schema';
import type { SourceType } from '@/db/schema';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { SCAN_FREQUENCY_OPTIONS } from '@/lib/validators/topics';

export const metadata: Metadata = {
  title: 'Topic Details',
};

interface TopicDetailPageProps {
  params: Promise<{ id: string }>;
}

const SOURCE_ICONS: Record<SourceType, React.ComponentType<{ className?: string }>> = {
  website: Globe,
  social_link: Link2,
  subreddit: MessageSquare,
  hashtag: Hash,
  search_term: Search,
  competitor_account: Users,
};

const SOURCE_LABELS: Record<SourceType, string> = {
  website: 'Website',
  social_link: 'Social Media',
  subreddit: 'Subreddit',
  hashtag: 'Hashtag',
  search_term: 'Search Term',
  competitor_account: 'Competitor',
};

function getFrequencyLabel(minutes: number): string {
  return SCAN_FREQUENCY_OPTIONS.find((o) => o.value === minutes)?.label ?? `${minutes} min`;
}

export default async function TopicDetailPage({ params }: TopicDetailPageProps) {
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
      {/* Back nav */}
      <div className="mb-6">
        <Link
          href="/topics"
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Topics
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <h1 className="truncate text-2xl font-bold">{topic.name}</h1>
            {topic.isActive ? (
              <Badge variant="secondary" className="shrink-0 text-xs">
                Active
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground shrink-0 text-xs">
                Inactive
              </Badge>
            )}
          </div>
          {topic.description && (
            <p className="text-muted-foreground mt-1 text-sm">{topic.description}</p>
          )}
        </div>
        <Link
          href={`/topics/${id}/edit`}
          className={buttonVariants({ variant: 'outline', size: 'sm', className: 'shrink-0' })}
        >
          <Edit2 className="h-4 w-4" />
          <span className="hidden sm:inline">Edit</span>
        </Link>
      </div>

      {/* Details grid */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <Clock className="text-muted-foreground h-5 w-5 shrink-0" />
            <div>
              <p className="text-muted-foreground text-xs">Scan Frequency</p>
              <p className="text-sm font-medium">
                Every {getFrequencyLabel(topic.scanFrequencyMinutes)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <Calendar className="text-muted-foreground h-5 w-5 shrink-0" />
            <div>
              <p className="text-muted-foreground text-xs">Created</p>
              <p className="text-sm font-medium">
                {topic.createdAt.toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Keywords */}
      {topic.keywords.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Keywords</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {topic.keywords.map((kw) => (
                <Badge key={kw} variant="secondary">
                  {kw}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sources */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Sources{' '}
            <span className="text-muted-foreground font-normal">
              ({topic.sources.length})
            </span>
          </CardTitle>
          <Link href={`/topics/${id}/edit`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Manage
          </Link>
        </CardHeader>
        <CardContent>
          {topic.sources.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No sources added yet.{' '}
              <Link href={`/topics/${id}/edit`} className="text-primary hover:underline">
                Add sources
              </Link>{' '}
              to improve trend discovery.
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {topic.sources.map((source) => {
                const Icon = SOURCE_ICONS[source.type];
                return (
                  <li key={source.id} className="flex items-center gap-3 py-2.5">
                    <Icon className="text-muted-foreground h-4 w-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{source.value}</p>
                      <p className="text-muted-foreground text-xs">
                        {source.label ?? SOURCE_LABELS[source.type]}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Scan History (placeholder) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scan History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Zap className="text-muted-foreground mb-3 h-8 w-8" />
            <p className="text-muted-foreground text-sm">No scans run yet</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Scan history will appear here once scanning begins
            </p>
            <Button disabled className="mt-4" variant="outline" size="sm">
              Scan Now (coming soon)
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator className="my-6" />

      {/* Danger zone */}
      <div className="rounded-lg border border-red-200 p-4 dark:border-red-900">
        <h3 className="mb-1 text-sm font-semibold text-red-600 dark:text-red-400">Danger Zone</h3>
        <p className="text-muted-foreground mb-3 text-xs">
          Deactivating a topic stops trend scanning. You can reactivate it later from the topics
          list.
        </p>
        <Link href={`/topics/${id}/edit`} className={buttonVariants({ variant: 'destructive', size: 'sm' })}>
          Manage Topic
        </Link>
      </div>
    </div>
  );
}
