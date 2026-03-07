import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { apiError, handleApiError } from '@/lib/utils/api-error';
import type { StyleProfile } from '@/types';

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const routeLogger = logger.child({ route: 'GET /api/style/profile' });

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Authentication required');
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { styleProfile: true },
    });

    routeLogger.info({ userId: session.user.id }, 'Style profile fetched');
    return NextResponse.json({ data: user?.styleProfile ?? null });
  } catch (error) {
    return handleApiError(error, routeLogger);
  }
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const routeLogger = logger.child({ route: 'PUT /api/style/profile' });

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Authentication required');
    }

    const body: unknown = await req.json();

    // Accept a partial or full StyleProfile for manual overrides
    const profile = body as Partial<StyleProfile>;

    // Fetch existing profile to merge into
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { styleProfile: true },
    });

    const merged = {
      ...(user?.styleProfile as StyleProfile | null | undefined),
      ...profile,
    };

    await db
      .update(users)
      .set({ styleProfile: merged, updatedAt: new Date() })
      .where(eq(users.id, session.user.id));

    routeLogger.info({ userId: session.user.id }, 'Style profile manually updated');
    return NextResponse.json({ data: merged });
  } catch (error) {
    return handleApiError(error, routeLogger);
  }
}
