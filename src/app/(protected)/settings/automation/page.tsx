'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Plus, Bot, Activity } from 'lucide-react';
import { AutomationRuleCard } from '@/components/features/automation/AutomationRuleCard';
import { RuleFormDialog } from '@/components/features/automation/RuleFormDialog';
import type { AutomationRule, Topic } from '@/db/schema';

interface RuleFormData {
  name: string;
  topicId: string | null;
  triggerType: 'after_scan' | 'scheduled' | 'manual';
  minViralityScore: number;
  actions: { type: 'auto_approve' | 'auto_generate' | 'auto_publish' | 'send_notification' }[];
}

interface AutomationLog {
  id: string;
  action: string;
  status: 'success' | 'skipped' | 'failed';
  createdAt: string;
  details: Record<string, unknown>;
}

export default function AutomationSettingsPage() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [topics, setTopics] = useState<Pick<Topic, 'id' | 'name'>[]>([]);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [allPaused, setAllPaused] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [rulesRes, topicsRes, logsRes] = await Promise.all([
        fetch('/api/automation/rules'),
        fetch('/api/topics'),
        fetch('/api/automation/logs?limit=20'),
      ]);

      if (rulesRes.ok) {
        const { data } = await rulesRes.json();
        setRules(data ?? []);
        setAllPaused((data ?? []).every((r: AutomationRule) => !r.isActive));
      }
      if (topicsRes.ok) {
        const { data } = await topicsRes.json();
        setTopics(data ?? []);
      }
      if (logsRes.ok) {
        const { data } = await logsRes.json();
        setLogs(data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleSaveRule(formData: RuleFormData) {
    const body = {
      name: formData.name,
      topicId: formData.topicId,
      triggerType: formData.triggerType,
      actions: formData.actions,
      conditions: formData.minViralityScore > 0 ? { minViralityScore: formData.minViralityScore } : {},
    };

    if (editingRule) {
      await fetch(`/api/automation/rules/${editingRule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } else {
      await fetch('/api/automation/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }

    setEditingRule(null);
    await fetchData();
  }

  async function handleToggle(id: string, isActive: boolean) {
    await fetch(`/api/automation/rules/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive }),
    });
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, isActive } : r)));
  }

  async function handleDelete(id: string) {
    await fetch(`/api/automation/rules/${id}`, { method: 'DELETE' });
    setRules((prev) => prev.filter((r) => r.id !== id));
  }

  async function handlePauseAll(paused: boolean) {
    await Promise.all(
      rules.map((r) =>
        fetch(`/api/automation/rules/${r.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: !paused }),
        })
      )
    );
    setRules((prev) => prev.map((r) => ({ ...r, isActive: !paused })));
    setAllPaused(paused);
  }

  const topicMap = Object.fromEntries(topics.map((t) => [t.id, t.name]));

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-xl">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Automation</h1>
            <p className="text-muted-foreground text-sm">Configure automated pipeline rules</p>
          </div>
        </div>
        <Button onClick={() => { setEditingRule(null); setDialogOpen(true); }} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          New Rule
        </Button>
      </div>

      {/* Master pause toggle */}
      {rules.length > 0 && (
        <div className="border-border bg-muted/30 flex items-center justify-between rounded-xl border p-4">
          <div>
            <p className="text-sm font-medium">Pause all automation</p>
            <p className="text-muted-foreground text-xs">Temporarily disable all active rules</p>
          </div>
          <div className="flex items-center gap-2">
            {allPaused && <Badge variant="secondary">All paused</Badge>}
            <Switch checked={allPaused} onCheckedChange={handlePauseAll} />
          </div>
        </div>
      )}

      {/* Rules list */}
      <section>
        <h2 className="mb-3 text-sm font-semibold">Rules</h2>
        {rules.length === 0 ? (
          <div className="border-border rounded-xl border border-dashed py-12 text-center">
            <Bot className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
            <p className="text-muted-foreground text-sm">No automation rules yet.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => { setEditingRule(null); setDialogOpen(true); }}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Create first rule
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <AutomationRuleCard
                key={rule.id}
                rule={rule}
                topicName={rule.topicId ? topicMap[rule.topicId] : undefined}
                onToggle={handleToggle}
                onEdit={(r) => { setEditingRule(r); setDialogOpen(true); }}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </section>

      <Separator />

      {/* Activity log */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Activity className="text-muted-foreground h-4 w-4" />
          <h2 className="text-sm font-semibold">Recent Activity</h2>
        </div>
        {logs.length === 0 ? (
          <p className="text-muted-foreground text-sm">No automation activity yet.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="border-border flex items-center gap-3 rounded-lg border px-3 py-2"
              >
                <div
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    log.status === 'success'
                      ? 'bg-green-500'
                      : log.status === 'failed'
                        ? 'bg-red-500'
                        : 'bg-yellow-500'
                  }`}
                />
                <span className="min-w-0 flex-1 truncate text-sm">{log.action}</span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Rule form dialog */}
      <RuleFormDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditingRule(null); }}
        onSave={handleSaveRule}
        topics={topics}
        initialData={editingRule}
      />
    </div>
  );
}
