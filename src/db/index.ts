import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

let _db: DrizzleDb | undefined;

export function getDb(): DrizzleDb {
  if (_db) return _db;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  _db = drizzle(neon(url), { schema });
  return _db;
}

// Convenience proxy that lazily initializes the db on first property access
export const db: DrizzleDb = new Proxy({} as DrizzleDb, {
  get(_target, prop: string | symbol) {
    const instance = getDb();
    const value = Reflect.get(instance, prop, instance);
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
  has(_target, prop) {
    return Reflect.has(getDb(), prop);
  },
  getPrototypeOf() {
    return Reflect.getPrototypeOf(getDb());
  },
});
