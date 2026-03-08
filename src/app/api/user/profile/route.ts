import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { logger } from '@/lib/logger';
import { apiError, handleApiError } from '@/lib/utils/api-error';
import { z } from 'zod';

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).max(100).optional(),
});

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const routeLogger = logger.child({ route: 'PATCH /api/user/profile' });

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'You must be logged in');
    }

    const body: unknown = await req.json();
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', parsed.error.flatten());
    }

    const { name, currentPassword, newPassword } = parsed.data;

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });

    if (!user) {
      return apiError('NOT_FOUND', 'User not found');
    }

    const updates: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };

    if (name !== undefined) {
      updates.name = name;
    }

    if (newPassword) {
      if (!currentPassword) {
        return apiError('VALIDATION_ERROR', 'Current password is required to set a new password');
      }
      if (!user.passwordHash) {
        return apiError('VALIDATION_ERROR', 'Account has no password set');
      }
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) {
        return apiError('FORBIDDEN', 'Current password is incorrect');
      }
      updates.passwordHash = await bcrypt.hash(newPassword, 12);
    }

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, session.user.id))
      .returning({ id: users.id, name: users.name, email: users.email });

    routeLogger.info({ userId: session.user.id }, 'User profile updated');

    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleApiError(error, routeLogger);
  }
}
