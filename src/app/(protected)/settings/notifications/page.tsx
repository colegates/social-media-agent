import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NotificationsSettingsClient } from '@/components/features/settings/NotificationsSettingsClient';

export const metadata: Metadata = {
  title: 'Notifications – Settings',
};

export default async function NotificationsSettingsPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { settings: true },
  });

  const settings = (user?.settings ?? {}) as Record<string, unknown>;
  const notifications = (settings.notifications ?? {}) as Record<string, boolean>;

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <p className="text-muted-foreground mt-1">
          Choose when you want to be notified about activity.
        </p>
      </div>

      <div className="max-w-md">
        <NotificationsSettingsClient initialSettings={notifications} />
      </div>
    </div>
  );
}
