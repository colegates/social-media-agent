import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { users, topics } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { AppShell } from '@/components/layout/AppShell';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  // Check onboarding status. Use a cookie as a fast path — once confirmed
  // complete, subsequent page loads skip the DB query entirely.
  const cookieStore = await cookies();
  const onboardingDone = cookieStore.get('onboarding_complete')?.value === '1';

  if (!onboardingDone && session.user.id) {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
        columns: { settings: true },
      });
      const settings = (user?.settings ?? {}) as Record<string, unknown>;

      if (!settings.onboardingCompleted) {
        // Only redirect brand-new users with no topics yet
        const existingTopic = await db.query.topics.findFirst({
          where: and(eq(topics.userId, session.user.id), eq(topics.isActive, true)),
          columns: { id: true },
        });

        if (!existingTopic) {
          redirect('/onboarding');
        }
      }
    } catch {
      // If the onboarding check fails (e.g. DB temporarily unavailable),
      // skip the redirect rather than crashing the layout.
    }
  }

  return <AppShell>{children}</AppShell>;
}
