import type { Metadata } from 'next';
import Link from 'next/link';
import { eq, and, desc, gte, inArray } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { topics, trends, scanJobs } from '@/db/schema';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { TrendingUp, BookMarked, FileText, Zap, RefreshCw } from 'lucide-react';
import { TrendsList } from '@/components/features/trends/TrendsList';
import type { TrendCardData } from '@/components/features/trends/TrendCard';

export const metadata: Metadata = {
  title: 'Dashboard',
};

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  // Fetch active topics
  const userTopics = await db
    .select({ id: topics.id, name: topics.name, scanFrequencyMinutes: topics.scanFrequencyMinutes })
    .from(topics)
    .where(and(eq(topics.userId, userId), eq(topics.isActive, true)));

  const topicIds = userTopics.map((t) => t.id);

  // Fetch stats and top trends in parallel
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [recentTrendsRaw, recentScans] = await Promise.all([
    topicIds.length > 0
      ? db
          .select({
            id: trends.id,
            topicId: trends.topicId,
            title: trends.title,
            description: trends.description,
            sourceUrl: trends.sourceUrl,
            platform: trends.platform,
            viralityScore: trends.viralityScore,
            engagementData: trends.engagementData,
            discoveredAt: trends.discoveredAt,
            expiresAt: trends.expiresAt,
          })
          .from(trends)
          .where(
            and(
              inArray(trends.topicId, topicIds),
              gte(trends.discoveredAt, sevenDaysAgo)
            )
          )
          .orderBy(desc(trends.viralityScore))
          .limit(20)
      : Promise.resolve([]),
    topicIds.length > 0
      ? db
          .select({ id: scanJobs.id, topicId: scanJobs.topicId, status: scanJobs.status })
          .from(scanJobs)
          .where(
            and(
              inArray(scanJobs.topicId, topicIds),
              gte(scanJobs.startedAt, sevenDaysAgo)
            )
          )
      : Promise.resolve([]),
  ]);

  const topicNameMap = new Map(userTopics.map((t) => [t.id, t.name]));
  const topTrends: TrendCardData[] = recentTrendsRaw.map((t) => ({
    ...t,
    engagementData: (t.engagementData ?? {}) as Record<string, unknown>,
    topicName: topicNameMap.get(t.topicId),
  }));

  const completedScans = recentScans.filter((s) => s.status === 'completed').length;

  const stats = [
    {
      label: 'Active Topics',
      value: String(userTopics.length),
      icon: BookMarked,
      description: 'Topics being monitored',
      href: '/topics',
    },
    {
      label: 'Trends Found',
      value: String(recentTrendsRaw.length),
      icon: TrendingUp,
      description: 'In the last 7 days',
      href: null,
    },
    {
      label: 'Scans Run',
      value: String(completedScans),
      icon: RefreshCw,
      description: 'Completed in last 7 days',
      href: null,
    },
    {
      label: 'Content Ideas',
      value: '0',
      icon: FileText,
      description: 'Awaiting review (Stage 5)',
      href: null,
    },
  ];

  const hasTopics = userTopics.length > 0;
  const hasTrends = topTrends.length > 0;

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Welcome header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold md:text-3xl">
          Welcome back{session?.user?.name ? `, ${session.user.name.split(' ')[0]}` : ''}!
        </h1>
        <p className="text-muted-foreground mt-1">
          Here&apos;s what&apos;s trending across your monitored topics.
        </p>
      </div>

      {/* Stats grid */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const cardContent = (
            <Card key={stat.label} className={stat.href ? 'hover:border-border/80 transition-colors' : ''}>
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
          return stat.href ? (
            <Link key={stat.label} href={stat.href}>
              {cardContent}
            </Link>
          ) : (
            <div key={stat.label}>{cardContent}</div>
          );
        })}
      </div>

      {/* Top Trends */}
      {hasTopics ? (
        <Card className="mb-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Top Trends</CardTitle>
              <CardDescription>Highest virality trends across all your topics (last 7 days)</CardDescription>
            </div>
            <Zap className="text-muted-foreground h-5 w-5" />
          </CardHeader>
          <CardContent>
            <TrendsList
              trends={topTrends}
              showTopicName
              emptyMessage="No trends discovered yet. Visit a topic and click 'Scan Now' to start discovering trends."
            />
            {hasTrends && (
              <div className="mt-4 text-center">
                <Link
                  href="/topics"
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  View all topics
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Getting started section */
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
                  href: '/topics/new',
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
      )}

      {/* Per-topic summary */}
      {hasTopics && (
        <Card>
          <CardHeader>
            <CardTitle>Topic Summary</CardTitle>
            <CardDescription>Your monitored topics at a glance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {userTopics.map((topic) => {
                const topicTrendCount = recentTrendsRaw.filter(
                  (t) => t.topicId === topic.id
                ).length;
                const topicScans = recentScans.filter((s) => s.topicId === topic.id);
                const lastScan = topicScans[topicScans.length - 1];

                return (
                  <Link
                    key={topic.id}
                    href={`/topics/${topic.id}`}
                    className="border-border hover:bg-accent flex items-center justify-between rounded-lg border p-3 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{topic.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {topicTrendCount} trends · scans every {topic.scanFrequencyMinutes}m
                      </p>
                    </div>
                    <div className="ml-3 flex shrink-0 items-center gap-2">
                      {topicTrendCount > 0 && (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <TrendingUp className="h-3 w-3" />
                          {topicTrendCount}
                        </Badge>
                      )}
                      {lastScan && (
                        <Badge
                          variant={lastScan.status === 'failed' ? 'destructive' : 'outline'}
                          className="text-xs capitalize"
                        >
                          {lastScan.status}
                        </Badge>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
