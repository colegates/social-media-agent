/**
 * Programmatic migration runner using the same Neon HTTP driver as the app.
 * This avoids SSL/connection issues with drizzle-kit's own pg client.
 * Run via: tsx src/db/run-migrations.ts
 */
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import path from 'path';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('[migrate] ERROR: DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  console.log('[migrate] Starting database migration...');

  const sql = neon(url);
  const db = drizzle(sql);

  // Always resolve from the project root so this works in any working directory
  const migrationsFolder = path.resolve('src/db/migrations');

  try {
    await migrate(db, { migrationsFolder });
    console.log('[migrate] All migrations applied successfully.');
  } catch (err) {
    console.error('[migrate] Migration failed:', err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[migrate] Unexpected error:', err);
  process.exit(1);
});
