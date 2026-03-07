'use client';

import { useState } from 'react';
import { TrendCard } from './TrendCard';
import { TrendDetailModal } from './TrendDetailModal';
import type { TrendCardData } from './TrendCard';
import { TrendingUp } from 'lucide-react';

interface TrendsListProps {
  trends: TrendCardData[];
  showTopicName?: boolean;
  emptyMessage?: string;
}

export function TrendsList({
  trends,
  showTopicName = false,
  emptyMessage = 'No trends found yet. Run a scan to discover trending content.',
}: TrendsListProps) {
  const [selectedTrend, setSelectedTrend] = useState<TrendCardData | null>(null);

  if (trends.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <TrendingUp className="text-muted-foreground mb-3 h-10 w-10" />
        <p className="text-muted-foreground text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {trends.map((trend) => (
          <TrendCard
            key={trend.id}
            trend={trend}
            onViewDetails={setSelectedTrend}
            showTopicName={showTopicName}
          />
        ))}
      </div>

      <TrendDetailModal
        trend={selectedTrend}
        onClose={() => setSelectedTrend(null)}
      />
    </>
  );
}
