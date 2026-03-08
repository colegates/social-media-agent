'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface NotificationOption {
  key: string;
  label: string;
  description: string;
  defaultValue: boolean;
}

const NOTIFICATION_OPTIONS: NotificationOption[] = [
  {
    key: 'newTrends',
    label: 'New high-virality trends',
    description: 'When a trend scores above 70/100 for any of your topics',
    defaultValue: true,
  },
  {
    key: 'ideasReady',
    label: 'Content ideas ready',
    description: 'After a scan generates new content ideas for review',
    defaultValue: true,
  },
  {
    key: 'contentGenerated',
    label: 'Content generation complete',
    description: 'When images, videos, or copy finish generating',
    defaultValue: false,
  },
  {
    key: 'reviewNeeded',
    label: 'Review needed',
    description: 'When automation-generated content is waiting for approval',
    defaultValue: true,
  },
  {
    key: 'scanFailed',
    label: 'Scan failures',
    description: 'When a scheduled trend scan fails to complete',
    defaultValue: false,
  },
];

interface NotificationsSettingsClientProps {
  initialSettings: Record<string, boolean>;
}

export function NotificationsSettingsClient({ initialSettings }: NotificationsSettingsClientProps) {
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() => {
    const defaults: Record<string, boolean> = {};
    for (const opt of NOTIFICATION_OPTIONS) {
      defaults[opt.key] = initialSettings[opt.key] ?? opt.defaultValue;
    }
    return defaults;
  });
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    try {
      const res = await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { notifications: prefs } }),
      });

      if (res.ok) {
        toast.success('Notification preferences saved');
      } else {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error ?? 'Failed to save preferences');
      }
    } catch {
      toast.error('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Email & push notifications</CardTitle>
        <CardDescription>
          These preferences apply to both in-app notifications and push alerts. Push notifications
          require browser permission to be granted.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {NOTIFICATION_OPTIONS.map((opt) => (
          <div key={opt.key} className="flex items-start gap-3">
            <Switch
              id={opt.key}
              checked={prefs[opt.key] ?? opt.defaultValue}
              onCheckedChange={(v) => setPrefs((prev) => ({ ...prev, [opt.key]: v }))}
              className="mt-0.5"
            />
            <div>
              <Label htmlFor={opt.key} className="cursor-pointer font-medium">
                {opt.label}
              </Label>
              <p className="text-muted-foreground text-xs">{opt.description}</p>
            </div>
          </div>
        ))}

        <Button onClick={handleSave} disabled={loading} className="mt-2 w-full">
          {loading ? 'Saving…' : 'Save preferences'}
        </Button>
      </CardContent>
    </Card>
  );
}
