import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { ProfileForm } from '@/components/features/settings/ProfileForm';

export const metadata: Metadata = {
  title: 'Profile – Settings',
};

export default async function ProfileSettingsPage() {
  const session = await auth();
  const user = session!.user!;

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-muted-foreground mt-1">Update your name and password.</p>
      </div>

      <div className="max-w-md">
        <ProfileForm
          initialName={user.name ?? ''}
          email={user.email ?? ''}
        />
      </div>
    </div>
  );
}
