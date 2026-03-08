import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { OnboardingWizard } from '@/components/features/onboarding/OnboardingWizard';

export const metadata: Metadata = {
  title: 'Get Started',
};

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { settings: true, name: true },
  });

  const settings = (user?.settings ?? {}) as Record<string, unknown>;

  // If already completed, send to dashboard
  if (settings.onboardingCompleted === true) {
    redirect('/dashboard');
  }

  return <OnboardingWizard userName={user?.name ?? null} />;
}
