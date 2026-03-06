// Re-export common types for use across the application

export type { User, NewUser } from '@/db/schema';

// Auth session extension
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
    };
  }
}
