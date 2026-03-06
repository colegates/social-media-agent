import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, BookMarked, FileText, Zap } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Dashboard',
};

export default async function DashboardPage() {
  const session = await auth();

  const stats = [
    {
      label: 'Active Topics',
      value: '0',
      icon: BookMarked,
      description: 'Topics being monitored',
    },
    {
      label: 'Trends Found',
      value: '0',
      icon: TrendingUp,
      description: 'In the last 7 days',
    },
    {
      label: 'Content Ideas',
      value: '0',
      icon: FileText,
      description: 'Awaiting review',
    },
    {
      label: 'Generated',
      value: '0',
      icon: Zap,
      description: 'Content pieces created',
    },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Welcome header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold md:text-3xl">
          Welcome back{session?.user?.name ? `, ${session.user.name.split(' ')[0]}` : ''}!
        </h1>
        <p className="text-muted-foreground mt-1">
          Here&apos;s what&apos;s happening with your social media monitoring.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
                <Icon className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-muted-foreground mt-1 text-xs">{stat.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Getting started section */}
      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>
              Complete these steps to set up your social media monitoring
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                {
                  step: 1,
                  title: 'Add your first topic',
                  description: 'Configure a topic to start monitoring trends',
                  href: '/topics',
                  status: 'pending' as const,
                },
                {
                  step: 2,
                  title: 'Set up your style profile',
                  description: 'Help the AI learn your brand voice',
                  href: '/settings/style',
                  status: 'pending' as const,
                },
                {
                  step: 3,
                  title: 'Run your first scan',
                  description: 'Discover trending content in your niche',
                  href: '/topics',
                  status: 'pending' as const,
                },
              ].map((item) => (
                <a
                  key={item.step}
                  href={item.href}
                  className="border-border hover:bg-accent flex items-start gap-4 rounded-lg border p-4 transition-colors"
                >
                  <div className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                    {item.step}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{item.title}</p>
                      <Badge variant="outline" className="text-xs">
                        {item.status}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mt-0.5 text-sm">{item.description}</p>
                  </div>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
