import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { automationLogs } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const querySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const routeLogger = logger.child({ route: 'GET /api/automation/logs' });

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

    const { limit, offset } = parsed.data;

    const logs = await db
      .select()
      .from(automationLogs)
      .where(eq(automationLogs.userId, session.user.id))
      .orderBy(desc(automationLogs.createdAt))
      .limit(limit)
      .offset(offset);

    routeLogger.info({ userId: session.user.id, count: logs.length }, 'Automation logs fetched');
    return NextResponse.json({ data: logs, meta: { limit, offset } });
  } catch (error) {
    routeLogger.error({ error }, 'Failed to fetch automation logs');
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
