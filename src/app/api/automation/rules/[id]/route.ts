import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { automationRules } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const updateRuleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  topicId: z.string().uuid().nullable().optional(),
  triggerType: z.enum(['after_scan', 'scheduled', 'manual']).optional(),
  actions: z
    .array(
      z.object({
        type: z.enum(['auto_approve', 'auto_generate', 'auto_publish', 'send_notification']),
        params: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .min(1)
    .optional(),
  conditions: z
    .object({
      minViralityScore: z.number().min(0).max(100).optional(),
      platforms: z.array(z.string()).optional(),
      contentTypes: z.array(z.string()).optional(),
    })
    .optional(),
  isActive: z.boolean().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const routeLogger = logger.child({ route: 'PUT /api/automation/rules/[id]', ruleId: id });

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = updateRuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };

    const [updated] = await db
      .update(automationRules)
      .set(updates)
      .where(and(eq(automationRules.id, id), eq(automationRules.userId, session.user.id)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Rule not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    routeLogger.info({ userId: session.user.id }, 'Automation rule updated');
    return NextResponse.json({ data: updated });
  } catch (error) {
    routeLogger.error({ error }, 'Failed to update automation rule');
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const routeLogger = logger.child({ route: 'DELETE /api/automation/rules/[id]', ruleId: id });

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const [deleted] = await db
      .delete(automationRules)
      .where(and(eq(automationRules.id, id), eq(automationRules.userId, session.user.id)))
      .returning({ id: automationRules.id });

    if (!deleted) {
      return NextResponse.json({ error: 'Rule not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    routeLogger.info({ userId: session.user.id }, 'Automation rule deleted');
    return NextResponse.json({ data: { id } });
  } catch (error) {
    routeLogger.error({ error }, 'Failed to delete automation rule');
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
