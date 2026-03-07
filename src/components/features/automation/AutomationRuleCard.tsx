'use client';

import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, Trash2, Zap, Clock, Hand } from 'lucide-react';
import type { AutomationRule } from '@/db/schema';

interface AutomationRuleCardProps {
  rule: AutomationRule;
  topicName?: string;
  onToggle: (id: string, isActive: boolean) => Promise<void>;
  onEdit: (rule: AutomationRule) => void;
  onDelete: (id: string) => Promise<void>;
}

const TRIGGER_ICONS = {
  after_scan: Zap,
  scheduled: Clock,
  manual: Hand,
} as const;

const TRIGGER_LABELS = {
  after_scan: 'After scan',
  scheduled: 'Scheduled',
  manual: 'Manual',
} as const;

const ACTION_LABELS: Record<string, string> = {
  auto_approve: 'Auto-approve',
  auto_generate: 'Auto-generate',
  auto_publish: 'Auto-publish',
  send_notification: 'Notify',
};

export function AutomationRuleCard({
  rule,
  topicName,
  onToggle,
  onEdit,
  onDelete,
}: AutomationRuleCardProps) {
  const TriggerIcon = TRIGGER_ICONS[rule.triggerType];
  const actions = rule.actions as { type: string }[];
  const conditions = rule.conditions as { minViralityScore?: number };

  return (
    <div className="border-border bg-card rounded-xl border p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
            <TriggerIcon className="h-4 w-4" />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-semibold">{rule.name}</h3>
              {!rule.isActive && (
                <Badge variant="secondary" className="text-xs">
                  Paused
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {TRIGGER_LABELS[rule.triggerType]}
              {topicName ? ` · ${topicName}` : ' · All topics'}
              {conditions.minViralityScore
                ? ` · Min virality ${conditions.minViralityScore}`
                : ''}
            </p>

            {/* Actions */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {actions.map((a) => (
                <Badge key={a.type} variant="outline" className="text-xs">
                  {ACTION_LABELS[a.type] ?? a.type}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            checked={rule.isActive}
            onCheckedChange={(v) => onToggle(rule.id, v)}
            aria-label={rule.isActive ? 'Disable rule' : 'Enable rule'}
          />

          <DropdownMenu>
            <DropdownMenuTrigger
              className="hover:bg-muted focus-visible:ring-ring/50 flex h-8 w-8 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2"
              aria-label="Rule actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(rule)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(rule.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
