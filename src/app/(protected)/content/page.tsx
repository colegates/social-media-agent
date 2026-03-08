import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb, Calendar, Sparkles, Library, ClipboardCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Content',
};

const CONTENT_SECTIONS = [
  {
    href: '/content/ideas',
    icon: Lightbulb,
    title: 'Content Ideas',
    description:
      'AI-generated content ideas from your trend scans. Approve, reject, or edit ideas before production.',
  },
  {
    href: '/content/studio',
    icon: Sparkles,
    title: 'Content Studio',
    description:
      'Generate images, videos, and posts from approved ideas using AI. Track generation progress in real time.',
  },
  {
    href: '/content/library',
    icon: Library,
    title: 'Content Library',
    description:
      'Browse all your generated assets — images, videos, copy, and carousels — ready to download or publish.',
  },
  {
    href: '/content/review',
    icon: ClipboardCheck,
    title: 'Review Queue',
    description:
      'Review automation-generated content before it goes live. Approve or reject in one click.',
  },
  {
    href: '/content/calendar',
    icon: Calendar,
    title: 'Content Calendar',
    description:
      'Monthly view of your scheduled ideas. Plan your content publishing schedule at a glance.',
  },
];

export default function ContentPage() {
  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Content Studio</h1>
        <p className="text-muted-foreground mt-1">
          Manage your content ideas, generated assets, and publishing schedule
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CONTENT_SECTIONS.map(({ href, icon: Icon, title, description }) => (
          <Link key={href} href={href} className="block">
            <Card className="hover:border-border/80 h-full transition-colors hover:shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="text-primary h-5 w-5" />
                  {title}
                </CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
