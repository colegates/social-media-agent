import type { Metadata } from 'next';
import Link from 'next/link';
import { and, eq, gte, lte, isNotNull } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { contentIdeas } from '@/db/schema';
import { ChevronLeft } from 'lucide-react';
import { ContentCalendar } from '@/components/features/ideas/ContentCalendar';
import type { ContentIdeaPlatform, ContentIdeaContentType, ContentIdeaStatus } from '@/db/schema';

export const metadata: Metadata = { title: 'Content Calendar' };

interface PageProps {
  searchParams: Promise<Record<string, string>>;
}

export default async function CalendarPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const session = await auth();
  const userId = session!.user!.id!;

  const now = new Date();
  const year = parseInt(params.year ?? String(now.getFullYear()));
  const month = parseInt(params.month ?? String(now.getMonth())); // 0-indexed

  // Month range
  const fromDate = new Date(year, month, 1);
  const toDate = new Date(year, month + 1, 0, 23, 59, 59);

  const results = await db
    .select({
      id: contentIdeas.id,
      title: contentIdeas.title,
      platform: contentIdeas.platform,
      contentType: contentIdeas.contentType,
      status: contentIdeas.status,
      priorityScore: contentIdeas.priorityScore,
      scheduledFor: contentIdeas.scheduledFor,
    })
    .from(contentIdeas)
    .where(
      and(
        eq(contentIdeas.userId, userId),
        isNotNull(contentIdeas.scheduledFor),
        gte(contentIdeas.scheduledFor, fromDate),
        lte(contentIdeas.scheduledFor, toDate)
      )
    )
    .orderBy(contentIdeas.scheduledFor);

  // Group by date
  const grouped = new Map<string, typeof results>();
  for (const idea of results) {
    if (!idea.scheduledFor) continue;
    const dateKey = idea.scheduledFor.toISOString().split('T')[0]!;
    const existing = grouped.get(dateKey) ?? [];
    existing.push(idea);
    grouped.set(dateKey, existing);
  }

  const calendarData = Array.from(grouped.entries()).map(([date, ideas]) => ({
    date,
    ideas: ideas as Array<{
      id: string;
      title: string;
      platform: ContentIdeaPlatform;
      contentType: ContentIdeaContentType;
      status: ContentIdeaStatus;
      priorityScore: number;
      scheduledFor: Date | null;
    }>,
  }));

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/content/ideas"
            className="text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1 text-sm transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Ideas
          </Link>
          <h1 className="text-2xl font-bold">Content Calendar</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Scheduled ideas at a glance. Click a day to see details.
          </p>
        </div>
      </div>

      <ContentCalendar calendarData={calendarData} year={year} month={month} />
    </div>
  );
}
