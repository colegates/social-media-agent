/**
 * Robust idempotent migration runner for Neon PostgreSQL.
 *
 * Unlike the drizzle-kit migrator, this runner:
 * - Executes each SQL statement individually (not the whole file at once)
 * - Skips statements that fail with "already exists" errors (safe to ignore)
 * - Tracks applied migrations by name in a __migrations table
 * - Works even if previous migration attempts left the DB in a partial state
 */
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

// PostgreSQL error codes meaning "object already exists" — safe to skip
const ALREADY_EXISTS_CODES = new Set([
  '42701', // duplicate_column
  '42P07', // duplicate_table / duplicate_index
  '42710', // duplicate_object (type, constraint, operator, etc.)
  '42P16', // invalid_table_definition (e.g. ALTER TYPE ADD VALUE for existing value)
  '23505', // unique_violation (constraint already exists)
]);

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('[migrate] ERROR: DATABASE_URL is not set');
    process.exit(1);
  }

  console.log('[migrate] Connecting...');
  const db = drizzle(neon(url));

  // Create migration tracking table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS __migrations (
      name text PRIMARY KEY,
      applied_at timestamptz DEFAULT now() NOT NULL
    )
  `);

  const migrationsDir = path.resolve('src/db/migrations');
  const journal = JSON.parse(
    fs.readFileSync(path.join(migrationsDir, 'meta', '_journal.json'), 'utf-8')
  );

  const appliedRows = await db.execute(sql`SELECT name FROM __migrations`);
  const applied = new Set((appliedRows.rows as { name: string }[]).map((r) => r.name));

  let appliedCount = 0;

  for (const entry of journal.entries) {
    const name: string = entry.tag;

    if (applied.has(name)) {
      console.log(`[migrate] ${name}: already applied, skipping`);
      continue;
    }

    const filePath = path.join(migrationsDir, `${name}.sql`);
    const statements = fs
      .readFileSync(filePath, 'utf-8')
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);

    console.log(`[migrate] ${name}: applying ${statements.length} statements...`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      try {
        await db.execute(sql.raw(stmt));
      } catch (err: unknown) {
        const code = (err as { code?: string }).code;
        const message = (err as { message?: string }).message ?? '';

        const alreadyExists =
          (code && ALREADY_EXISTS_CODES.has(code)) ||
          message.toLowerCase().includes('already exists');

        if (alreadyExists) {
          console.log(
            `[migrate]   stmt ${i + 1}/${statements.length}: skipped (already exists, code=${code ?? 'n/a'})`
          );
        } else {
          console.error(
            `[migrate]   stmt ${i + 1}/${statements.length} FAILED (code=${code ?? 'n/a'}):`
          );
          console.error(`[migrate]   ${message}`);
          console.error(`[migrate]   sql: ${stmt.slice(0, 300)}`);
          process.exit(1);
        }
      }
    }

    await db.execute(sql`INSERT INTO __migrations (name) VALUES (${name})`);
    console.log(`[migrate] ${name}: done`);
    appliedCount++;
  }

  console.log(`[migrate] Complete — ${appliedCount} migration(s) applied.`);
}

main().catch((err) => {
  console.error('[migrate] Fatal error:', err);
  process.exit(1);
});
