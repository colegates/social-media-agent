import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb, Calendar, Sparkles } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Content',
};

export default function ContentPage() {
  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Content Studio</h1>
        <p className="text-muted-foreground mt-1">
          Manage your content ideas, calendar, and generated assets
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/content/ideas" className="block">
          <Card className="hover:border-border/80 h-full transition-colors hover:shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Lightbulb className="text-primary h-5 w-5" />
                Content Ideas
              </CardTitle>
              <CardDescription>
                AI-generated content ideas from your trend scans. Approve, reject, or edit ideas
                before production.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/content/calendar" className="block">
          <Card className="hover:border-border/80 h-full transition-colors hover:shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="text-primary h-5 w-5" />
                Content Calendar
              </CardTitle>
              <CardDescription>
                Monthly view of your scheduled ideas. Plan your content publishing schedule at a
                glance.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Card className="opacity-60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-5 w-5" />
              Content Generator
            </CardTitle>
            <CardDescription>
              Generate images, videos, and full posts from approved ideas. Coming in Stage 6.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
