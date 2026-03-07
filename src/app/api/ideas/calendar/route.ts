import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { eq, and, gte, lte, isNotNull } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { contentIdeas, topics } from '@/db/schema';
import { logger } from '@/lib/logger';
import { apiError, handleApiError } from '@/lib/utils/api-error';
import { calendarQuerySchema } from '@/lib/validators/ideas';
import type { ContentIdea } from '@/db/schema';

const routeLogger = logger.child({ route: 'GET /api/ideas/calendar' });

type CalendarEntry = Pick<
  ContentIdea,
  'id' | 'title' | 'platform' | 'contentType' | 'status' | 'priorityScore' | 'scheduledFor'
>;

interface CalendarDay {
  date: string; // ISO date string YYYY-MM-DD
  ideas: CalendarEntry[];
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const start = Date.now();

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'You must be logged in');
    }
    const userId = session.user.id;

    const searchParams = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = calendarQuerySchema.safeParse(searchParams);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid query parameters', parsed.error.flatten());
    }

    const { fromDate, toDate, topicId, platform } = parsed.data;

    // Build conditions
    const conditions = [
      eq(contentIdeas.userId, userId),
      isNotNull(contentIdeas.scheduledFor),
      gte(contentIdeas.scheduledFor, fromDate),
      lte(contentIdeas.scheduledFor, toDate),
    ];

    if (topicId) {
      const topic = await db.query.topics.findFirst({
        where: and(eq(topics.id, topicId), eq(topics.userId, userId)),
        columns: { id: true },
      });
      if (!topic) {
        return apiError('NOT_FOUND', 'Topic not found');
      }
      conditions.push(eq(contentIdeas.topicId, topicId));
    }

    if (platform) {
      conditions.push(eq(contentIdeas.platform, platform));
    }

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
      .where(and(...conditions))
      .orderBy(contentIdeas.scheduledFor, contentIdeas.priorityScore);

    // Group by date
    const grouped = new Map<string, CalendarEntry[]>();

    for (const idea of results) {
      if (!idea.scheduledFor) continue;
      const dateKey = idea.scheduledFor.toISOString().split('T')[0]!;
      const existing = grouped.get(dateKey) ?? [];
      existing.push(idea as CalendarEntry);
      grouped.set(dateKey, existing);
    }

    const calendar: CalendarDay[] = Array.from(grouped.entries())
      .map(([date, ideas]) => ({ date, ideas }))
      .sort((a, b) => a.date.localeCompare(b.date));

    routeLogger.info(
      { userId, days: calendar.length, totalIdeas: results.length, duration: Date.now() - start },
      'Calendar fetched'
    );

    return NextResponse.json({ data: calendar });
  } catch (error) {
    return handleApiError(error, routeLogger);
  }
}
