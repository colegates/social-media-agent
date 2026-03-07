/**
 * POST /api/ideas/bulk-delete
 *
 * Delete multiple content ideas at once.
 *
 * Body:
 * {
 *   ids?: string[]        // specific idea IDs to delete
 *   topicId?: string      // delete all ideas for a topic (combined with status filter)
 *   statuses?: string[]   // only delete ideas in these statuses
 *   olderThanDays?: number // only delete ideas older than N days
 * }
 *
 * At least one of `ids` or `topicId` is required.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { eq, and, lt, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { contentIdeas, topics } from '@/db/schema';
import { logger } from '@/lib/logger';
import { apiError, handleApiError } from '@/lib/utils/api-error';

const bulkDeleteLogger = logger.child({ route: 'POST /api/ideas/bulk-delete' });

const bulkDeleteSchema = z
  .object({
    ids: z.array(z.string().uuid()).min(1).max(500).optional(),
    topicId: z.string().uuid().optional(),
    statuses: z
      .array(
        z.enum([
          'suggested',
          'approved',
          'rejected',
          'in_production',
          'completed',
          'published',
        ])
      )
      .optional(),
    olderThanDays: z.number().int().min(1).max(3650).optional(),
  })
  .refine((d) => d.ids !== undefined || d.topicId !== undefined, {
    message: 'Provide either `ids` or `topicId`',
  });

export async function POST(req: NextRequest): Promise<NextResponse> {
  const start = Date.now();

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'You must be logged in');
    }

    const body: unknown = await req.json();
    const parsed = bulkDeleteSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', parsed.error.flatten());
    }

    const { ids, topicId, statuses, olderThanDays } = parsed.data;
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

    const conditions = [eq(contentIdeas.userId, userId)];

    if (ids && ids.length > 0) {
      conditions.push(inArray(contentIdeas.id, ids));
    }

    if (topicId) {
      conditions.push(eq(contentIdeas.topicId, topicId));
    }

    if (statuses && statuses.length > 0) {
      conditions.push(inArray(contentIdeas.status, statuses));
    }

    if (olderThanDays) {
      const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
      conditions.push(lt(contentIdeas.createdAt, cutoff));
    }

    const deleted = await db
      .delete(contentIdeas)
      .where(and(...conditions))
      .returning({ id: contentIdeas.id });

    bulkDeleteLogger.info(
      { userId, topicId, deletedCount: deleted.length, duration: Date.now() - start },
      'Bulk delete completed'
    );

    return NextResponse.json({ data: { deleted: deleted.length, ids: deleted.map((r) => r.id) } });
  } catch (error) {
    return handleApiError(error, bulkDeleteLogger);
  }
}
