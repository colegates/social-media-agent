import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { logger } from '@/lib/logger';
import { apiError, handleApiError } from '@/lib/utils/api-error';
import { z } from 'zod';

const updateSettingsSchema = z.object({
  settings: z.record(z.string(), z.unknown()),
});

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const routeLogger = logger.child({ route: 'PATCH /api/user/settings' });

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'You must be logged in');
    }

    const body: unknown = await req.json();
    const parsed = updateSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', parsed.error.flatten());
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { settings: true },
    });

    const current = (user?.settings ?? {}) as Record<string, unknown>;
    const merged = { ...current, ...parsed.data.settings };

    await db
      .update(users)
      .set({ settings: merged, updatedAt: new Date() })
      .where(eq(users.id, session.user.id));

    routeLogger.info({ userId: session.user.id }, 'User settings updated');

    return NextResponse.json({ data: merged });
  } catch (error) {
    return handleApiError(error, routeLogger);
  }
}

export async function GET(): Promise<NextResponse> {
  const routeLogger = logger.child({ route: 'GET /api/user/settings' });

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'You must be logged in');
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { settings: true },
    });

    return NextResponse.json({ data: user?.settings ?? {} });
  } catch (error) {
    return handleApiError(error, routeLogger);
  }
}
