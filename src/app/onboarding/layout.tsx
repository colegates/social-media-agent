import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="mx-auto max-w-2xl px-4 py-8">{children}</div>
    </div>
  );
}
