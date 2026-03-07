import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { pushSubscriptions } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const routeLogger = logger.child({ route: 'POST /api/notifications/subscribe' });

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = subscribeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { endpoint, keys } = parsed.data;

    // Upsert subscription
    await db
      .insert(pushSubscriptions)
      .values({
        userId: session.user.id,
        endpoint,
        p256dhKey: keys.p256dh,
        authKey: keys.auth,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { p256dhKey: keys.p256dh, authKey: keys.auth },
      });

    routeLogger.info({ userId: session.user.id }, 'Push subscription registered');
    return NextResponse.json({ data: { success: true } }, { status: 201 });
  } catch (error) {
    routeLogger.error({ error }, 'Failed to register push subscription');
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const routeLogger = logger.child({ route: 'DELETE /api/notifications/subscribe' });

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = unsubscribeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, session.user.id),
          eq(pushSubscriptions.endpoint, parsed.data.endpoint)
        )
      );

    routeLogger.info({ userId: session.user.id }, 'Push subscription removed');
    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    routeLogger.error({ error }, 'Failed to remove push subscription');
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
