'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import type { AutomationRule, Topic } from '@/db/schema';

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

interface ActionConfig {
  type: 'auto_approve' | 'auto_generate' | 'auto_publish' | 'send_notification';
}

interface RuleFormData {
  name: string;
  topicId: string | null;
  triggerType: 'after_scan' | 'scheduled' | 'manual';
  minViralityScore: number;
  actions: ActionConfig[];
}

interface RuleFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: RuleFormData) => Promise<void>;
  topics: Pick<Topic, 'id' | 'name'>[];
  initialData?: AutomationRule | null;
}

const ACTION_OPTIONS: { value: ActionConfig['type']; label: string; description: string }[] = [
  { value: 'auto_approve', label: 'Auto-approve ideas', description: 'Automatically approve generated content ideas' },
  { value: 'auto_generate', label: 'Auto-generate content', description: 'Automatically generate content from approved ideas' },
  { value: 'auto_publish', label: 'Auto-publish content', description: 'Automatically mark generated content for publishing' },
  { value: 'send_notification', label: 'Send notification', description: 'Send an in-app and push notification' },
];

const TRIGGER_OPTIONS = [
  { value: 'after_scan', label: 'After trend scan' },
  { value: 'scheduled', label: 'On schedule' },
  { value: 'manual', label: 'Manual only' },
] as const;

// ─────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────

export function RuleFormDialog({
  open,
  onClose,
  onSave,
  topics,
  initialData,
}: RuleFormDialogProps) {
  const initialConditions = (initialData?.conditions as { minViralityScore?: number } | null) ?? {};
  const initialActions = (initialData?.actions as ActionConfig[] | null) ?? [];

  const [name, setName] = useState(initialData?.name ?? '');
  const [topicId, setTopicId] = useState<string | null>(initialData?.topicId ?? null);
  const [triggerType, setTriggerType] = useState<RuleFormData['triggerType']>(
    initialData?.triggerType ?? 'after_scan'
  );
  const [minViralityScore, setMinViralityScore] = useState(
    initialConditions.minViralityScore ?? 0
  );
  const [selectedActions, setSelectedActions] = useState<Set<ActionConfig['type']>>(
    new Set(initialActions.map((a) => a.type))
  );
  const [saving, setSaving] = useState(false);

  function toggleAction(type: ActionConfig['type']) {
    setSelectedActions((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  async function handleSubmit() {
    if (!name.trim()) return;
    if (selectedActions.size === 0) return;

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        topicId,
        triggerType,
        minViralityScore,
        actions: Array.from(selectedActions).map((type) => ({ type })),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Edit Rule' : 'Create Automation Rule'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Rule Name */}
          <div className="space-y-1.5">
            <Label htmlFor="rule-name">Rule name</Label>
            <Input
              id="rule-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Auto-approve high-virality ideas"
            />
          </div>

          {/* Trigger */}
          <div className="space-y-1.5">
            <Label htmlFor="rule-trigger">Trigger</Label>
            <Select
              id="rule-trigger"
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value as RuleFormData['triggerType'])}
            >
              {TRIGGER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>

          {/* Topic scope */}
          <div className="space-y-1.5">
            <Label htmlFor="rule-topic">Topic scope</Label>
            <Select
              id="rule-topic"
              value={topicId ?? 'all'}
              onChange={(e) => setTopicId(e.target.value === 'all' ? null : e.target.value)}
            >
              <option value="all">All topics (global)</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Min virality */}
          <div className="space-y-2">
            <Label>Minimum virality score: {minViralityScore}</Label>
            <Slider
              min={0}
              max={100}
              step={5}
              value={[minViralityScore]}
              onValueChange={(vals) => {
                const v = Array.isArray(vals) ? (vals[0] ?? 0) : (vals as number);
                setMinViralityScore(v);
              }}
            />
            <p className="text-muted-foreground text-xs">
              Only trigger when trends score at or above this threshold (0 = any).
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <Label>Actions</Label>
            <div className="space-y-3">
              {ACTION_OPTIONS.map((opt) => (
                <div key={opt.value} className="flex items-start gap-3">
                  <Checkbox
                    id={`action-${opt.value}`}
                    checked={selectedActions.has(opt.value)}
                    onCheckedChange={() => toggleAction(opt.value)}
                    className="mt-0.5"
                  />
                  <div>
                    <label htmlFor={`action-${opt.value}`} className="cursor-pointer text-sm font-medium">
                      {opt.label}
                    </label>
                    <p className="text-muted-foreground text-xs">{opt.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !name.trim() || selectedActions.size === 0}
          >
            {saving ? 'Saving…' : initialData ? 'Update Rule' : 'Create Rule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
