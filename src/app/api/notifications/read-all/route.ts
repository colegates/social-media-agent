import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { notifications } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export async function POST(_req: NextRequest): Promise<NextResponse> {
  const routeLogger = logger.child({ route: 'POST /api/notifications/read-all' });

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, session.user.id), eq(notifications.isRead, false)));

    routeLogger.info({ userId: session.user.id }, 'All notifications marked as read');
    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    routeLogger.error({ error }, 'Failed to mark all notifications as read');
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
