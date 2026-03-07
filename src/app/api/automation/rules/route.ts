import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { automationRules } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const actionSchema = z.object({
  type: z.enum(['auto_approve', 'auto_generate', 'auto_publish', 'send_notification']),
  params: z.record(z.string(), z.unknown()).optional(),
});

const conditionsSchema = z.object({
  minViralityScore: z.number().min(0).max(100).optional(),
  platforms: z.array(z.string()).optional(),
  contentTypes: z.array(z.string()).optional(),
});

const createRuleSchema = z.object({
  name: z.string().min(1).max(100),
  topicId: z.string().uuid().nullable().optional(),
  triggerType: z.enum(['after_scan', 'scheduled', 'manual']),
  actions: z.array(actionSchema).min(1),
  conditions: conditionsSchema.optional().default({}),
  isActive: z.boolean().optional().default(true),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const routeLogger = logger.child({ route: 'GET /api/automation/rules' });

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const rules = await db
      .select()
      .from(automationRules)
      .where(eq(automationRules.userId, session.user.id))
      .orderBy(desc(automationRules.createdAt));

    routeLogger.info({ userId: session.user.id, count: rules.length }, 'Automation rules fetched');
    return NextResponse.json({ data: rules });
  } catch (error) {
    routeLogger.error({ error }, 'Failed to fetch automation rules');
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const routeLogger = logger.child({ route: 'POST /api/automation/rules' });

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createRuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, topicId, triggerType, actions, conditions, isActive } = parsed.data;

    const [rule] = await db
      .insert(automationRules)
      .values({
        userId: session.user.id,
        name,
        topicId: topicId ?? null,
        triggerType,
        actions,
        conditions,
        isActive,
      })
      .returning();

    routeLogger.info({ userId: session.user.id, ruleId: rule.id }, 'Automation rule created');
    return NextResponse.json({ data: rule }, { status: 201 });
  } catch (error) {
    routeLogger.error({ error }, 'Failed to create automation rule');
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
