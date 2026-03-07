'use client';

import { useState } from 'react';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

const DATA_TYPE_LABELS: Record<string, string> = {
  trends: 'Trends',
  scan_jobs: 'Scan History',
  content_ideas: 'Content Ideas',
  generated_content: 'Generated Content',
};

const AGE_OPTIONS = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 60, label: '60 days' },
  { value: 90, label: '90 days' },
  { value: 180, label: '6 months' },
  { value: 365, label: '1 year' },
];

interface PurgeResult {
  dataType: string;
  deleted: number;
  dryRun: boolean;
}

interface PurgeResponse {
  data: {
    results: PurgeResult[];
    totalDeleted: number;
    dryRun: boolean;
    cutoffDate: string;
  };
}

export function DataManagementClient() {
  const [dataTypes, setDataTypes] = useState<Set<string>>(new Set(['trends']));
  const [olderThanDays, setOlderThanDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<PurgeResponse['data'] | null>(null);

  function toggleDataType(type: string) {
    setDataTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  async function runPurge(dryRun: boolean) {
    if (dataTypes.size === 0) {
      toast.error('Select at least one data type to purge');
      return;
    }

    setLoading(true);
    setLastResult(null);

    try {
      const res = await fetch('/api/purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataTypes: [...dataTypes],
          olderThanDays,
          dryRun,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? 'Purge failed');
      }

      const { data } = (await res.json()) as PurgeResponse;
      setLastResult(data);

      if (dryRun) {
        toast.info(`Dry run: would delete ${data.totalDeleted} record(s)`);
      } else {
        toast.success(`Deleted ${data.totalDeleted} record(s)`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Data type selection */}
      <div className="space-y-2">
        <Label>Data to purge</Label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(DATA_TYPE_LABELS).map(([type, label]) => (
            <button
              key={type}
              type="button"
              onClick={() => toggleDataType(type)}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                dataTypes.has(type)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Age threshold */}
      <div className="space-y-2">
        <Label htmlFor="older-than">Older than</Label>
        <Select
          id="older-than"
          value={String(olderThanDays)}
          onChange={(e) => setOlderThanDays(Number(e.target.value))}
        >
          {AGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
        <p className="text-muted-foreground text-xs">
          Records created more than {AGE_OPTIONS.find((o) => o.value === olderThanDays)?.label} ago
          will be deleted.
        </p>
      </div>

      {/* Last result */}
      {lastResult && (
        <div className="rounded-lg border p-3 text-sm">
          <p className="mb-2 font-medium">
            {lastResult.dryRun ? 'Dry run result' : 'Purge result'} —{' '}
            {lastResult.totalDeleted} record(s){' '}
            {lastResult.dryRun ? 'would be deleted' : 'deleted'}
          </p>
          <ul className="text-muted-foreground space-y-0.5">
            {lastResult.results.map((r) => (
              <li key={r.dataType} className="flex items-center gap-2">
                <span>{DATA_TYPE_LABELS[r.dataType] ?? r.dataType}</span>
                <Badge variant="secondary" className="text-xs">
                  {r.deleted}
                </Badge>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground mt-2 text-xs">
            Cutoff: {new Date(lastResult.cutoffDate).toLocaleDateString()}
          </p>
        </div>
      )}

      {/* Warning */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/20">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-amber-800 dark:text-amber-300">
          Deletion is permanent. Use <strong>Dry run</strong> first to see what would be removed.
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => runPurge(true)}
          disabled={loading || dataTypes.size === 0}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Dry run
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={() => runPurge(false)}
          disabled={loading || dataTypes.size === 0}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Purge
        </Button>
      </div>
    </div>
  );
}
