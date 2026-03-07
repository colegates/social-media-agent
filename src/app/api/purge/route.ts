/**
 * POST /api/purge
 *
 * Flexible data purge endpoint. Deletes old data records with fine-grained control.
 *
 * Body:
 * {
 *   dataTypes: Array<'trends' | 'scan_jobs' | 'content_ideas' | 'generated_content'>
 *   olderThanDays: number          // delete records older than this many days
 *   topicId?: string               // optional: scope to a single topic
 *   statuses?: string[]            // optional: filter by status (for content_ideas / generated_content)
 *   dryRun?: boolean               // if true, only return counts without deleting
 * }
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { eq, and, lt, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { topics, trends, scanJobs, contentIdeas, generatedContent } from '@/db/schema';
import { logger } from '@/lib/logger';
import { apiError, handleApiError } from '@/lib/utils/api-error';

const purgeLogger = logger.child({ route: 'POST /api/purge' });

const DATA_TYPES = ['trends', 'scan_jobs', 'content_ideas', 'generated_content'] as const;
type DataType = (typeof DATA_TYPES)[number];

const purgeSchema = z.object({
  dataTypes: z
    .array(z.enum(DATA_TYPES))
    .min(1, 'At least one data type is required')
    .max(4),
  olderThanDays: z
    .number()
    .int()
    .min(1, 'olderThanDays must be at least 1')
    .max(3650, 'olderThanDays cannot exceed 10 years'),
  topicId: z.string().uuid().optional(),
  statuses: z.array(z.string().min(1)).optional(),
  dryRun: z.boolean().optional().default(false),
});

type PurgeInput = z.infer<typeof purgeSchema>;

interface PurgeResult {
  dataType: DataType;
  deleted: number;
  dryRun: boolean;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const start = Date.now();

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'You must be logged in');
    }

    const body: unknown = await req.json();
    const parsed = purgeSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', parsed.error.flatten());
    }

    const { dataTypes, olderThanDays, topicId, statuses, dryRun } = parsed.data;
    const userId = session.user.id;

    // Verify topicId belongs to user if provided
    if (topicId) {
      const topic = await db.query.topics.findFirst({
        where: and(eq(topics.id, topicId), eq(topics.userId, userId)),
        columns: { id: true },
      });
      if (!topic) {
        return apiError('NOT_FOUND', 'Topic not found');
      }
    }

    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const results: PurgeResult[] = [];

    for (const dataType of dataTypes) {
      const count = await purgeDataType({
        dataType,
        userId,
        topicId,
        cutoffDate,
        statuses,
        dryRun,
      });
      results.push({ dataType, deleted: count, dryRun });
    }

    const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0);

    purgeLogger.info(
      {
        userId,
        topicId,
        olderThanDays,
        dataTypes,
        totalDeleted,
        dryRun,
        duration: Date.now() - start,
      },
      dryRun ? 'Purge dry run completed' : 'Purge completed'
    );

    return NextResponse.json({
      data: {
        results,
        totalDeleted,
        dryRun,
        cutoffDate: cutoffDate.toISOString(),
      },
    });
  } catch (error) {
    return handleApiError(error, purgeLogger);
  }
}

interface PurgeOptions {
  dataType: DataType;
  userId: string;
  topicId?: string;
  cutoffDate: Date;
  statuses?: string[];
  dryRun: boolean;
}

async function purgeDataType({
  dataType,
  userId,
  topicId,
  cutoffDate,
  statuses,
  dryRun,
}: PurgeOptions): Promise<number> {
  switch (dataType) {
    case 'trends':
      return purgeTrends({ userId, topicId, cutoffDate, dryRun });

    case 'scan_jobs':
      return purgeScanJobs({ userId, topicId, cutoffDate, statuses, dryRun });

    case 'content_ideas':
      return purgeContentIdeas({ userId, topicId, cutoffDate, statuses, dryRun });

    case 'generated_content':
      return purgeGeneratedContent({ userId, topicId, cutoffDate, statuses, dryRun });
  }
}

// ─────────────────────────────────────────────────────────
// Trends
// ─────────────────────────────────────────────────────────

async function purgeTrends({
  userId,
  topicId,
  cutoffDate,
  dryRun,
}: Omit<PurgeOptions, 'dataType' | 'statuses'>): Promise<number> {
  // Trends belong to topics which belong to users — join via subquery
  const userTopicIds = await getUserTopicIds(userId, topicId);
  if (userTopicIds.length === 0) return 0;

  const conditions = and(
    inArray(trends.topicId, userTopicIds),
    lt(trends.discoveredAt, cutoffDate)
  );

  if (dryRun) {
    const rows = await db
      .select({ id: trends.id })
      .from(trends)
      .where(conditions);
    return rows.length;
  }

  const deleted = await db.delete(trends).where(conditions).returning({ id: trends.id });
  return deleted.length;
}

// ─────────────────────────────────────────────────────────
// Scan Jobs
// ─────────────────────────────────────────────────────────

async function purgeScanJobs({
  userId,
  topicId,
  cutoffDate,
  statuses,
  dryRun,
}: Omit<PurgeOptions, 'dataType'>): Promise<number> {
  const userTopicIds = await getUserTopicIds(userId, topicId);
  if (userTopicIds.length === 0) return 0;

  const statusFilter =
    statuses && statuses.length > 0
      ? inArray(scanJobs.status, statuses as ('pending' | 'running' | 'completed' | 'failed')[])
      : undefined;

  const conditions = and(
    inArray(scanJobs.topicId, userTopicIds),
    lt(scanJobs.startedAt, cutoffDate),
    statusFilter
  );

  if (dryRun) {
    const rows = await db
      .select({ id: scanJobs.id })
      .from(scanJobs)
      .where(conditions);
    return rows.length;
  }

  const deleted = await db.delete(scanJobs).where(conditions).returning({ id: scanJobs.id });
  return deleted.length;
}

// ─────────────────────────────────────────────────────────
// Content Ideas
// ─────────────────────────────────────────────────────────

async function purgeContentIdeas({
  userId,
  topicId,
  cutoffDate,
  statuses,
  dryRun,
}: Omit<PurgeOptions, 'dataType'>): Promise<number> {
  const topicFilter = topicId ? eq(contentIdeas.topicId, topicId) : undefined;

  const statusFilter =
    statuses && statuses.length > 0
      ? inArray(
          contentIdeas.status,
          statuses as ('suggested' | 'approved' | 'rejected' | 'in_production' | 'completed' | 'published')[]
        )
      : undefined;

  const conditions = and(
    eq(contentIdeas.userId, userId),
    lt(contentIdeas.createdAt, cutoffDate),
    topicFilter,
    statusFilter
  );

  if (dryRun) {
    const rows = await db
      .select({ id: contentIdeas.id })
      .from(contentIdeas)
      .where(conditions);
    return rows.length;
  }

  const deleted = await db
    .delete(contentIdeas)
    .where(conditions)
    .returning({ id: contentIdeas.id });
  return deleted.length;
}

// ─────────────────────────────────────────────────────────
// Generated Content
// ─────────────────────────────────────────────────────────

async function purgeGeneratedContent({
  userId,
  topicId,
  cutoffDate,
  statuses,
  dryRun,
}: Omit<PurgeOptions, 'dataType'>): Promise<number> {
  // generatedContent doesn't have topicId directly; filter via contentIdeas if topicId given
  let ideaIds: string[] | undefined;
  if (topicId) {
    const ideas = await db
      .select({ id: contentIdeas.id })
      .from(contentIdeas)
      .where(and(eq(contentIdeas.userId, userId), eq(contentIdeas.topicId, topicId)));
    ideaIds = ideas.map((i) => i.id);
    if (ideaIds.length === 0) return 0;
  }

  const statusFilter =
    statuses && statuses.length > 0
      ? inArray(
          generatedContent.status,
          statuses as ('pending' | 'generating' | 'completed' | 'failed' | 'approved' | 'published')[]
        )
      : undefined;

  const ideaFilter = ideaIds ? inArray(generatedContent.contentIdeaId, ideaIds) : undefined;

  const conditions = and(
    eq(generatedContent.userId, userId),
    lt(generatedContent.createdAt, cutoffDate),
    ideaFilter,
    statusFilter
  );

  if (dryRun) {
    const rows = await db
      .select({ id: generatedContent.id })
      .from(generatedContent)
      .where(conditions);
    return rows.length;
  }

  const deleted = await db
    .delete(generatedContent)
    .where(conditions)
    .returning({ id: generatedContent.id });
  return deleted.length;
}

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

async function getUserTopicIds(userId: string, topicId?: string): Promise<string[]> {
  if (topicId) return [topicId];

  const rows = await db
    .select({ id: topics.id })
    .from(topics)
    .where(eq(topics.userId, userId));

  return rows.map((r) => r.id);
}
