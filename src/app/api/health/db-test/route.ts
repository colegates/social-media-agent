import { NextResponse } from 'next/server';
import { sql, eq, count } from 'drizzle-orm';
import { db } from '@/db';
import { auth } from '@/lib/auth';
import { topics, contentIdeas } from '@/db/schema';

export async function GET(): Promise<NextResponse> {
  const steps: Record<string, unknown> = {};

  try {
    steps.auth = 'starting';
    const session = await auth();
    const userId = session?.user?.id;
    steps.auth = userId ? `ok (id=${userId})` : 'no session or user.id';

    if (!userId) {
      return NextResponse.json({ ok: false, steps, error: 'not authenticated' }, { status: 401 });
    }

    steps.topicsQuery = 'starting';
    const userTopics = await db
      .select({ id: topics.id, name: topics.name })
      .from(topics)
      .where(eq(topics.userId, userId));
    steps.topicsQuery = `ok — ${userTopics.length} topic(s)`;

    steps.ideasQuery = 'starting';
    const ideaStats = await db
      .select({ status: contentIdeas.status, total: count() })
      .from(contentIdeas)
      .where(eq(contentIdeas.userId, userId))
      .groupBy(contentIdeas.status);
    steps.ideasQuery = `ok — ${ideaStats.length} status group(s)`;

    steps.rawSql = 'starting';
    const raw = await db.execute(sql`SELECT current_user, current_database(), version()`);
    steps.rawSql = raw.rows[0];

    return NextResponse.json({ ok: true, steps });
  } catch (err: unknown) {
    const e = err as Record<string, unknown>;
    const cause = (e.cause ?? {}) as Record<string, unknown>;
    return NextResponse.json(
      {
        ok: false,
        steps,
        error: {
          message: String(e.message ?? ''),
          causeMessage: String(cause.message ?? ''),
          code: String(e.code ?? cause.code ?? ''),
          stack: String(e.stack ?? '')
            .split('\n')
            .slice(0, 10),
        },
      },
      { status: 500 }
    );
  }
}
