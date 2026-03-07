import type { Metadata } from 'next';
import Link from 'next/link';
import { and, eq, desc, count, inArray } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { contentIdeas, topics } from '@/db/schema';
import { buttonVariants } from '@/lib/button-variants';
import { Card, CardContent } from '@/components/ui/card';
import { Lightbulb } from 'lucide-react';
import { IdeaFilters } from '@/components/features/ideas/IdeaFilters';
import { IdeasFeed } from '@/components/features/ideas/IdeasFeed';
import { GenerateIdeasButton } from '@/components/features/ideas/GenerateIdeasButton';
import type { IdeaCardData } from '@/components/features/ideas/IdeaCard';
import type { ContentIdeaPlatform, ContentIdeaContentType, ContentIdeaStatus } from '@/db/schema';

export const metadata: Metadata = { title: 'Content Ideas' };

interface PageProps {
  searchParams: Promise<Record<string, string>>;
}

export default async function IdeasPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const session = await auth();
  const userId = session!.user!.id!;

  const page = Math.max(1, parseInt(params.page ?? '1'));
  const limit = 20;
  const offset = (page - 1) * limit;

  const topicId = params.topicId;
  const platform = params.platform as ContentIdeaPlatform | undefined;
  const contentType = params.contentType as ContentIdeaContentType | undefined;
  const status = params.status as ContentIdeaStatus | undefined;
  const sortBy = (params.sortBy ?? 'priorityScore') as
    | 'priorityScore'
    | 'createdAt'
    | 'scheduledFor';

  if (topicId) {
    const topic = await db.query.topics.findFirst({
      where: and(eq(topics.id, topicId), eq(topics.userId, userId)),
      columns: { id: true },
    });
    if (!topic) {
      return <div className="p-6 text-sm text-red-500">Topic not found</div>;
    }
  }

  const conditions = [eq(contentIdeas.userId, userId)];
  if (topicId) conditions.push(eq(contentIdeas.topicId, topicId));
  if (platform) conditions.push(eq(contentIdeas.platform, platform));
  if (contentType) conditions.push(eq(contentIdeas.contentType, contentType));
  if (status) conditions.push(eq(contentIdeas.status, status));

  const orderCol =
    sortBy === 'createdAt'
      ? contentIdeas.createdAt
      : sortBy === 'scheduledFor'
        ? contentIdeas.scheduledFor
        : contentIdeas.priorityScore;

  // Load ALL topics (active + inactive) first so we can derive activeTopicIds for stats
  const userTopics = await db
    .select({ id: topics.id, name: topics.name, isActive: topics.isActive })
    .from(topics)
    .where(eq(topics.userId, userId));

  const activeTopicIds = userTopics.filter((t) => t.isActive).map((t) => t.id);

  const [results, [totalRow], statsRows] = await Promise.all([
    db
      .select({
        id: contentIdeas.id,
        topicId: contentIdeas.topicId,
        trendId: contentIdeas.trendId,
        title: contentIdeas.title,
        description: contentIdeas.description,
        platform: contentIdeas.platform,
        contentType: contentIdeas.contentType,
        suggestedCopy: contentIdeas.suggestedCopy,
        priorityScore: contentIdeas.priorityScore,
        status: contentIdeas.status,
        scheduledFor: contentIdeas.scheduledFor,
        createdAt: contentIdeas.createdAt,
      })
      .from(contentIdeas)
      .where(and(...conditions))
      .orderBy(desc(orderCol))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(contentIdeas)
      .where(and(...conditions)),
    // Stats only for active topics — inactive topics are excluded from summary counts
    activeTopicIds.length > 0
      ? db
          .select({ status: contentIdeas.status, total: count() })
          .from(contentIdeas)
          .where(and(eq(contentIdeas.userId, userId), inArray(contentIdeas.topicId, activeTopicIds)))
          .groupBy(contentIdeas.status)
      : Promise.resolve([]),
  ]);

  const totalCount = totalRow?.total ?? 0;
  const ideas = results as IdeaCardData[];

  const statsByStatus = Object.fromEntries(statsRows.map((r) => [r.status, r.total]));
  const totalGenerated = statsRows.reduce((sum, r) => sum + r.total, 0);
  const totalApproved = statsByStatus.approved ?? 0;
  const totalPending = statsByStatus.suggested ?? 0;

  // Only show active topics in the filter dropdown
  const activeTopics = userTopics.filter((t) => t.isActive);

  const currentFilters: Record<string, string> = {};
  if (topicId) currentFilters.topicId = topicId;
  if (platform) currentFilters.platform = platform;
  if (contentType) currentFilters.contentType = contentType;
  if (status) currentFilters.status = status;
  if (sortBy !== 'priorityScore') currentFilters.sortBy = sortBy;

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Content Ideas</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            AI-generated ideas from your latest trend scans
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href="/content/calendar"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            Calendar
          </Link>
          {activeTopics.length > 0 && <GenerateIdeasButton topics={activeTopics} />}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{totalGenerated}</div>
            <p className="text-muted-foreground text-xs">Total ideas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-emerald-600">{totalApproved}</div>
            <p className="text-muted-foreground text-xs">Approved</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-amber-600">{totalPending}</div>
            <p className="text-muted-foreground text-xs">Pending review</p>
          </CardContent>
        </Card>
      </div>

      {activeTopics.length > 0 && (
        <div className="mb-5">
          <IdeaFilters topics={activeTopics} currentFilters={currentFilters} />
        </div>
      )}

      {totalCount > 0 && (
        <p className="text-muted-foreground mb-3 text-xs">
          {totalCount} idea{totalCount !== 1 ? 's' : ''}
          {Object.keys(currentFilters).length > 0 ? ' matching filters' : ''}
        </p>
      )}

      {totalGenerated === 0 ? (
        // True empty state — no ideas exist at all
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Lightbulb className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
          {userTopics.length === 0 ? (
            <>
              <p className="font-medium">No topics yet</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Create a topic and run a scan to generate content ideas.
              </p>
              <Link
                href="/topics/new"
                className={`mt-4 inline-flex ${buttonVariants({ size: 'sm' })}`}
              >
                Add a Topic
              </Link>
            </>
          ) : (
            <>
              <p className="font-medium">No ideas yet</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Run a scan on one of your topics to generate content ideas.
              </p>
            </>
          )}
        </div>
      ) : (
        <IdeasFeed
          initialIdeas={ideas}
          totalCount={totalCount}
          page={page}
          filters={currentFilters}
        />
      )}
    </div>
  );
}
