import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { notifications } from '@/db/schema';
import { and, eq, desc } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const querySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  unreadOnly: z.enum(['true', 'false']).optional(),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const routeLogger = logger.child({ route: 'GET /api/notifications' });

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const parsed = querySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { limit, offset, unreadOnly } = parsed.data;

    const conditions = [eq(notifications.userId, session.user.id)];
    if (unreadOnly === 'true') {
      conditions.push(eq(notifications.isRead, false));
    }

    const rows = await db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    // Count unread
    const unreadRows = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.userId, session.user.id), eq(notifications.isRead, false)));

    routeLogger.info({ userId: session.user.id, count: rows.length }, 'Notifications fetched');

    return NextResponse.json({
      data: rows,
      meta: { total: rows.length, unreadCount: unreadRows.length, limit, offset },
    });
  } catch (error) {
    routeLogger.error({ error }, 'Failed to fetch notifications');
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
