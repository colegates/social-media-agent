import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { loginSchema } from '@/lib/validators/auth';
import { logger } from '@/lib/logger';

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Required when running behind a reverse proxy (e.g. Render, Vercel, AWS)
  trustHost: true,
  // JWT strategy - no database adapter needed for session storage
  session: {
    strategy: 'jwt',
    maxAge: 15 * 60, // 15 minutes
  },
  pages: {
    signIn: '/login',
    newUser: '/dashboard',
  },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          logger.warn({ errors: parsed.error.flatten() }, 'Login validation failed');
          return null;
        }

        const { email, password } = parsed.data;

        const user = await db.query.users.findFirst({
          where: eq(users.email, email.toLowerCase()),
        });

        if (!user || !user.passwordHash) {
          logger.warn({ email }, 'Login failed: user not found or no password');
          return null;
        }

        const passwordValid = await bcrypt.compare(password, user.passwordHash);
        if (!passwordValid) {
          logger.warn({ userId: user.id }, 'Login failed: invalid password');
          return null;
        }

        logger.info({ userId: user.id, email: user.email }, 'User logged in successfully');

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? null,
          image: user.image ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
