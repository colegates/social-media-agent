import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { styleExamples, users } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StyleExamplesManager } from '@/components/features/style/StyleExamplesManager';
import { StyleProfileViewer } from '@/components/features/style/StyleProfileViewer';
import { StyleTestGenerator } from '@/components/features/style/StyleTestGenerator';
import type { StyleProfile } from '@/types';
import { BookOpen, Brain, Sparkles } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Style Profile',
};

export default async function StyleSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const [exampleRows, userRow] = await Promise.all([
    db.query.styleExamples.findMany({
      where: eq(styleExamples.userId, session.user.id),
      orderBy: [desc(styleExamples.createdAt)],
    }),
    db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { styleProfile: true },
    }),
  ]);

  const styleProfile = (userRow?.styleProfile as StyleProfile | null) ?? null;

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Style Profile</h1>
        <p className="text-muted-foreground mt-1">
          Teach Claude your brand voice by adding content examples
        </p>
      </div>

      <div className="max-w-3xl space-y-6">
        {/* Examples Manager */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4" />
              Style Examples
            </CardTitle>
            <CardDescription>
              Add posts, articles, or guidelines that represent your brand voice. The more examples
              you add, the more accurately Claude can learn your style.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StyleExamplesManager initialExamples={exampleRows} />
          </CardContent>
        </Card>

        {/* Profile Viewer + Analyse */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4" />
              Style Analysis
            </CardTitle>
            <CardDescription>
              Run Claude&apos;s analysis on your examples to generate a structured style profile.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StyleProfileViewer
              initialProfile={styleProfile}
              exampleCount={exampleRows.length}
            />
          </CardContent>
        </Card>

        {/* Test Generator */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4" />
              Test My Style
            </CardTitle>
            <CardDescription>
              Enter a topic and platform to see a sample post generated in your brand voice.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StyleTestGenerator hasProfile={styleProfile !== null} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
