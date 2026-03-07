import { redirect } from 'next/navigation';
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

  // Redirect new users to onboarding if they haven't completed it.
  // Only redirect if the user has no topics (i.e. truly brand-new) to avoid
  // disrupting existing users added before Stage 8.
  if (session.user.id) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { settings: true },
    });
    const settings = (user?.settings ?? {}) as Record<string, unknown>;

    if (!settings.onboardingCompleted) {
      // Check if they already have topics (pre-onboarding user)
      const existingTopic = await db.query.topics.findFirst({
        where: and(eq(topics.userId, session.user.id), eq(topics.isActive, true)),
        columns: { id: true },
      });

      if (!existingTopic) {
        redirect('/onboarding');
      }
    }
  }

  return <AppShell>{children}</AppShell>;
}
