'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle, Clock, RefreshCw, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export interface ScanJobSummary {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  trendsFound: number;
  startedAt: string | Date;
  completedAt?: string | Date | null;
  errorLog?: string | null;
}

interface ScanHistoryProps {
  topicId: string;
  initialScans: ScanJobSummary[];
  nextScanAt?: Date | null;
}

const STATUS_CONFIG = {
  pending: { icon: Clock, label: 'Pending', colour: 'text-muted-foreground' },
  running: { icon: RefreshCw, label: 'Running', colour: 'text-blue-500' },
  completed: { icon: CheckCircle2, label: 'Completed', colour: 'text-green-500' },
  failed: { icon: XCircle, label: 'Failed', colour: 'text-destructive' },
} as const;

function formatDuration(start: string | Date, end: string | Date | null | undefined): string {
  if (!end) return '—';
  const startMs = typeof start === 'string' ? new Date(start).getTime() : start.getTime();
  const endMs = typeof end === 'string' ? new Date(end).getTime() : end.getTime();
  const diffSec = Math.round((endMs - startMs) / 1000);
  if (diffSec < 60) return `${diffSec}s`;
  return `${Math.floor(diffSec / 60)}m ${diffSec % 60}s`;
}

function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ScanHistory({ topicId, initialScans, nextScanAt }: ScanHistoryProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [scans, setScans] = useState<ScanJobSummary[]>(initialScans);

  async function handleScanNow() {
    setIsScanning(true);
    try {
      const response = await fetch(`/api/topics/${topicId}/scan`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? 'Failed to start scan');
      }

      toast.success('Scan started! Results will appear shortly.');

      // Refresh scan list after a short delay
      setTimeout(async () => {
        try {
          const scansRes = await fetch(`/api/topics/${topicId}/scans`);
          if (scansRes.ok) {
            const data = (await scansRes.json()) as { data: ScanJobSummary[] };
            setScans(data.data);
          }
        } catch {
          // ignore
        }
      }, 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start scan';
      toast.error(message);
    } finally {
      setIsScanning(false);
    }
  }

  return (
    <div>
      {/* Scan now button & next scan time */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          {nextScanAt && (
            <p className="text-muted-foreground text-xs">
              Next scheduled scan: {formatDateTime(nextScanAt)}
            </p>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleScanNow}
          disabled={isScanning}
          className="gap-2"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isScanning ? 'animate-spin' : ''}`} />
          {isScanning ? 'Starting…' : 'Scan Now'}
        </Button>
      </div>

      {scans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <RefreshCw className="text-muted-foreground mb-3 h-8 w-8" />
          <p className="text-muted-foreground text-sm">No scans run yet</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Click &quot;Scan Now&quot; to discover trending content
          </p>
        </div>
      ) : (
        <ul className="divide-border divide-y">
          {scans.map((scan) => {
            const config = STATUS_CONFIG[scan.status];
            const Icon = config.icon;
            return (
              <li key={scan.id} className="py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 shrink-0 ${config.colour}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{config.label}</span>
                        {scan.status === 'completed' && scan.trendsFound > 0 && (
                          <Badge variant="secondary" className="gap-1 text-xs">
                            <TrendingUp className="h-3 w-3" />
                            {scan.trendsFound} trends
                          </Badge>
                        )}
                        {scan.status === 'completed' && scan.trendsFound === 0 && (
                          <span className="text-muted-foreground text-xs">No new trends</span>
                        )}
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {formatDateTime(scan.startedAt)}
                        {scan.completedAt && ` · ${formatDuration(scan.startedAt, scan.completedAt)}`}
                      </p>
                      {scan.status === 'failed' && scan.errorLog && (
                        <p className="text-destructive mt-1 text-xs">{scan.errorLog.slice(0, 100)}</p>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
