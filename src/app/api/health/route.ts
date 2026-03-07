import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { sql } from 'drizzle-orm';
import { db } from '@/db';

export async function GET(): Promise<NextResponse> {
  const routeLogger = logger.child({ route: 'GET /api/health' });

  let dbStatus: 'ok' | 'error' = 'error';
  let dbError: string | null = null;
  let tables: string[] = [];

  try {
    const result = await db.execute(
      sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
    );
    tables = (result.rows as { table_name: string }[]).map((r) => r.table_name);
    dbStatus = 'ok';
  } catch (err: unknown) {
    const e = err as Record<string, unknown>;
    const cause = (e.cause ?? {}) as Record<string, unknown>;
    dbError = String(cause.message ?? e.message ?? 'unknown error');
  }

  const response = {
    status: dbStatus === 'ok' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '0.1.0',
    db: { status: dbStatus, tables, error: dbError },
  };

  routeLogger.debug(response, 'Health check requested');

  return NextResponse.json(response, { status: dbStatus === 'ok' ? 200 : 503 });
}
