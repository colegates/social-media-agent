export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { registerSchema } from '@/lib/validators/auth';
import { logger } from '@/lib/logger';
import { apiError, handleApiError } from '@/lib/utils/api-error';
import { checkRateLimit, authRateLimiter } from '@/lib/utils/rate-limit';

const BCRYPT_ROUNDS = 12;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const routeLogger = logger.child({ route: 'POST /api/auth/register' });
  const startTime = Date.now();

  // Rate limiting
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';
  const rateLimitResult = await checkRateLimit(authRateLimiter, `register:${ip}`);
  if (!rateLimitResult.allowed) {
    routeLogger.warn({ ip }, 'Rate limit exceeded for registration');
    return apiError(
      'RATE_LIMITED',
      'Too many registration attempts. Please try again in a minute.'
    );
  }

  try {
    const body: unknown = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', parsed.error.flatten());
    }

    const { name, email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    // Check if email already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, normalizedEmail),
    });

    if (existingUser) {
      return apiError('CONFLICT', 'An account with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        email: normalizedEmail,
        passwordHash,
        name,
      })
      .returning({ id: users.id, email: users.email, name: users.name });

    const duration = Date.now() - startTime;
    routeLogger.info(
      { userId: newUser.id, email: newUser.email, duration },
      'User registered successfully'
    );

    return NextResponse.json(
      { message: 'Account created successfully', userId: newUser.id },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, routeLogger);
  }
}
