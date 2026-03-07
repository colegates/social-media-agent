import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { notifications } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export async function PUT(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const routeLogger = logger.child({ route: 'PUT /api/notifications/[id]/read', notificationId: id });

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const [updated] = await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, session.user.id)))
      .returning({ id: notifications.id });

    if (!updated) {
      return NextResponse.json({ error: 'Notification not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    routeLogger.info({ userId: session.user.id }, 'Notification marked as read');
    return NextResponse.json({ data: { id } });
  } catch (error) {
    routeLogger.error({ error }, 'Failed to mark notification as read');
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
