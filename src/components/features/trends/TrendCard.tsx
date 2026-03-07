'use client';

import { ExternalLink, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PlatformIcon } from './PlatformIcon';

export interface TrendCardData {
  id: string;
  title: string;
  description?: string | null;
  sourceUrl?: string | null;
  platform: string;
  viralityScore: number;
  engagementData: Record<string, unknown>;
  discoveredAt: string | Date;
  topicName?: string;
}

interface TrendCardProps {
  trend: TrendCardData;
  onViewDetails?: (trend: TrendCardData) => void;
  showTopicName?: boolean;
}

function getScoreColour(score: number): string {
  if (score >= 70) return 'text-green-600 dark:text-green-400';
  if (score >= 40) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-muted-foreground';
}

function formatEngagement(engagementData: Record<string, unknown>): string {
  const parts: string[] = [];
  const { likes, views, upvotes, shares, comments } = engagementData as {
    likes?: number;
    views?: number;
    upvotes?: number;
    shares?: number;
    comments?: number;
  };

  const formatNum = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  };

  if (views && views > 0) parts.push(`${formatNum(views)} views`);
  else if ((likes ?? 0) + (upvotes ?? 0) > 0)
    parts.push(`${formatNum((likes ?? 0) + (upvotes ?? 0))} likes`);
  if (shares && shares > 0) parts.push(`${formatNum(shares)} shares`);
  if (comments && comments > 0) parts.push(`${formatNum(comments)} comments`);

  return parts.slice(0, 2).join(' · ') || 'No engagement data';
}

function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

export function TrendCard({ trend, onViewDetails, showTopicName = false }: TrendCardProps) {
  return (
    <Card className="hover:border-border/80 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Platform icon */}
          <div className="mt-0.5 shrink-0">
            <PlatformIcon platform={trend.platform} className="h-5 w-5" />
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-start justify-between gap-2">
              <p className="line-clamp-2 text-sm font-medium leading-snug">{trend.title}</p>
              {/* Virality score */}
              <div className="flex shrink-0 flex-col items-center gap-0.5">
                <TrendingUp className={`h-4 w-4 ${getScoreColour(trend.viralityScore)}`} />
                <span className={`text-xs font-semibold tabular-nums ${getScoreColour(trend.viralityScore)}`}>
                  {trend.viralityScore}
                </span>
              </div>
            </div>

            {trend.description && (
              <p className="text-muted-foreground mb-2 line-clamp-2 text-xs">{trend.description}</p>
            )}

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Badge variant="outline" className="text-xs capitalize">
                {trend.platform}
              </Badge>
              {showTopicName && trend.topicName && (
                <Badge variant="secondary" className="text-xs">
                  {trend.topicName}
                </Badge>
              )}
              <span className="text-muted-foreground text-xs">
                {formatEngagement(trend.engagementData)}
              </span>
              <span className="text-muted-foreground text-xs">
                {formatRelativeTime(trend.discoveredAt)}
              </span>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onViewDetails?.(trend)}
              >
                View Details
              </Button>
              {trend.sourceUrl && (
                <a
                  href={trend.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  Source
                </a>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
