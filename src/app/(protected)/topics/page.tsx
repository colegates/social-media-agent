import type { Metadata } from 'next';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { topics } from '@/db/schema';
import { TopicsClient } from '@/components/features/topics/TopicsClient';

export const metadata: Metadata = {
  title: 'Topics',
};

export default async function TopicsPage() {
  const session = await auth();
  // session is guaranteed by the protected layout
  const userId = session!.user!.id!;

  const userTopics = await db.query.topics.findMany({
    where: eq(topics.userId, userId),
    with: { sources: true },
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });

  // Filter to show only active topics by default; inactive ones are still in DB
  const activeTopics = userTopics.filter((t) => t.isActive);

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <TopicsClient initialTopics={activeTopics} />
    </div>
  );
}
