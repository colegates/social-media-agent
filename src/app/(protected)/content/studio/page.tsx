import type { Metadata } from 'next';
import Link from 'next/link';
import { eq, and, desc } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { contentIdeas } from '@/db/schema';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, ArrowRight } from 'lucide-react';
import { PlatformIcon } from '@/components/features/ideas/PlatformIcon';

export const metadata: Metadata = { title: 'Content Studio' };

export default async function ContentStudioIndexPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  // Show approved ideas ready for content generation
  const approvedIdeas = await db
    .select({
      id: contentIdeas.id,
      title: contentIdeas.title,
      platform: contentIdeas.platform,
      contentType: contentIdeas.contentType,
      priorityScore: contentIdeas.priorityScore,
      createdAt: contentIdeas.createdAt,
    })
    .from(contentIdeas)
    .where(and(eq(contentIdeas.userId, userId), eq(contentIdeas.status, 'approved')))
    .orderBy(desc(contentIdeas.priorityScore))
    .limit(50);

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Content Studio</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Pick an approved idea to generate images, videos, and copy with AI.
        </p>
      </div>

      {approvedIdeas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Sparkles className="text-muted-foreground mb-4 h-10 w-10" />
          <h2 className="mb-2 text-lg font-semibold">No approved ideas yet</h2>
          <p className="text-muted-foreground mb-4 text-sm">
            Approve content ideas first, then come back here to generate images, videos, and posts.
          </p>
          <Link
            href="/content/ideas"
            className="text-primary inline-flex items-center gap-1 text-sm underline"
          >
            Browse content ideas
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {approvedIdeas.map((idea) => (
            <Link key={idea.id} href={`/content/studio/${idea.id}`} className="block">
              <Card className="hover:border-border/80 h-full cursor-pointer transition-colors hover:shadow-sm">
                <CardHeader className="pb-3">
                  <div className="mb-2 flex items-center gap-2">
                    <PlatformIcon platform={idea.platform} className="h-4 w-4" />
                    <Badge variant="outline" className="text-xs capitalize">
                      {idea.contentType.replace('_', ' ')}
                    </Badge>
                    {idea.priorityScore >= 70 && (
                      <Badge className="bg-orange-500 text-xs text-white">Hot</Badge>
                    )}
                  </div>
                  <CardTitle className="line-clamp-2 text-sm font-medium leading-snug">
                    {idea.title}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {idea.platform.replace('_', ' ')} ·{' '}
                    {new Date(idea.createdAt).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
