import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { topics } from '@/db/schema';
import { logger } from '@/lib/logger';
import { apiError, handleApiError } from '@/lib/utils/api-error';
import { updateTopicSchema } from '@/lib/validators/topics';
import {
  scheduleTopicScan,
  removeTopicScan,
  scheduleTopicContentGeneration,
  removeTopicContentGeneration,
} from '@/lib/queue/scheduler';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  const routeLogger = logger.child({ route: 'GET /api/topics/[id]', topicId: id });
  const start = Date.now();

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'You must be logged in');
    }

    const topic = await db.query.topics.findFirst({
      where: and(eq(topics.id, id), eq(topics.userId, session.user.id)),
      with: { sources: true },
    });

    if (!topic) {
      return apiError('NOT_FOUND', 'Topic not found');
    }

    routeLogger.info({ userId: session.user.id, duration: Date.now() - start }, 'Topic fetched');

    return NextResponse.json({ data: topic });
  } catch (error) {
    return handleApiError(error, routeLogger);
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  const routeLogger = logger.child({ route: 'PUT /api/topics/[id]', topicId: id });
  const start = Date.now();

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'You must be logged in');
    }

    const existing = await db.query.topics.findFirst({
      where: and(eq(topics.id, id), eq(topics.userId, session.user.id)),
    });
    if (!existing) {
      return apiError('NOT_FOUND', 'Topic not found');
    }

    const body: unknown = await req.json();
    const parsed = updateTopicSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', parsed.error.flatten());
    }

    const updates = parsed.data;

    const [updated] = await db
      .update(topics)
      .set({
        ...updates,
        description:
          updates.description === '' ? null : (updates.description ?? existing.description),
        updatedAt: new Date(),
      })
      .where(and(eq(topics.id, id), eq(topics.userId, session.user.id)))
      .returning();

    // Update BullMQ schedules when relevant fields change (non-fatal)
    if (process.env.REDIS_URL) {
      const isNowActive = updated.isActive;
      const scanFreqChanged =
        updates.scanFrequencyMinutes !== undefined &&
        updates.scanFrequencyMinutes !== existing.scanFrequencyMinutes;
      const contentGenFreqChanged =
        updates.contentGenerationFrequencyMinutes !== undefined &&
        updates.contentGenerationFrequencyMinutes !== existing.contentGenerationFrequencyMinutes;
      const activationChanged =
        updates.isActive !== undefined && isNowActive !== existing.isActive;

      try {
        if (!isNowActive) {
          if (activationChanged) {
            await removeTopicScan(id);
            await removeTopicContentGeneration(id);
          }
        } else if (activationChanged) {
          // Re-activated: restore schedules
          await scheduleTopicScan(id, session.user.id, updated.scanFrequencyMinutes);
          await scheduleTopicContentGeneration(
            id,
            session.user.id,
            updated.contentGenerationFrequencyMinutes ?? null
          );
        } else {
          if (scanFreqChanged) {
            await scheduleTopicScan(id, session.user.id, updated.scanFrequencyMinutes);
          }
          if (contentGenFreqChanged) {
            await scheduleTopicContentGeneration(
              id,
              session.user.id,
              updated.contentGenerationFrequencyMinutes ?? null
            );
          }
        }
      } catch (scheduleErr) {
        routeLogger.warn(
          { err: scheduleErr, topicId: id },
          'Failed to update BullMQ schedule — will sync on worker restart'
        );
      }
    }

    routeLogger.info(
      { userId: session.user.id, topicId: id, duration: Date.now() - start },
      'Topic updated'
    );

    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleApiError(error, routeLogger);
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  const routeLogger = logger.child({ route: 'DELETE /api/topics/[id]', topicId: id });
  const start = Date.now();

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'You must be logged in');
    }

    const existing = await db.query.topics.findFirst({
      where: and(eq(topics.id, id), eq(topics.userId, session.user.id)),
    });
    if (!existing) {
      return apiError('NOT_FOUND', 'Topic not found');
    }

    // Soft delete: set isActive = false
    await db
      .update(topics)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(topics.id, id), eq(topics.userId, session.user.id)));

    // Remove BullMQ schedules (non-fatal)
    if (process.env.REDIS_URL) {
      try {
        await removeTopicScan(id);
        await removeTopicContentGeneration(id);
      } catch (scheduleErr) {
        routeLogger.warn(
          { err: scheduleErr, topicId: id },
          'Failed to remove BullMQ schedules on delete — non-fatal'
        );
      }
    }

    routeLogger.info(
      { userId: session.user.id, topicId: id, duration: Date.now() - start },
      'Topic soft-deleted'
    );

    return NextResponse.json({ data: { id, deleted: true } });
  } catch (error) {
    return handleApiError(error, routeLogger);
  }
}
