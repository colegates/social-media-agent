'use client';

import { useState } from 'react';
import { Loader2, RefreshCw, ChevronDown, ChevronUp, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { StyleProfile } from '@/types';

interface StyleProfileViewerProps {
  initialProfile: StyleProfile | null;
  exampleCount: number;
}

const VOCABULARY_LABELS: Record<string, string> = {
  simple: 'Simple',
  moderate: 'Moderate',
  advanced: 'Advanced',
};

const EMOJI_LABELS: Record<string, string> = {
  none: 'None',
  minimal: 'Minimal',
  moderate: 'Moderate',
  heavy: 'Heavy',
};

const HASHTAG_LABELS: Record<string, string> = {
  none: 'None',
  minimal: 'Minimal',
  branded: 'Branded',
  trending: 'Trending',
};

function ProfileBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{label}</p>
      <Badge variant="secondary" className="text-sm">
        {value}
      </Badge>
    </div>
  );
}

function TagList({ items, variant = 'default' }: { items: string[]; variant?: 'default' | 'destructive' }) {
  if (items.length === 0) return <p className="text-muted-foreground text-sm">None specified</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Badge key={item} variant={variant === 'destructive' ? 'outline' : 'secondary'} className={variant === 'destructive' ? 'border-destructive/30 text-destructive' : ''}>
          {item}
        </Badge>
      ))}
    </div>
  );
}

export function StyleProfileViewer({ initialProfile, exampleCount }: StyleProfileViewerProps) {
  const [profile, setProfile] = useState<StyleProfile | null>(initialProfile);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [showPlatformDetails, setShowPlatformDetails] = useState(false);

  async function handleAnalyse() {
    if (exampleCount === 0) {
      toast.error('Add at least one style example before analysing');
      return;
    }
    setIsAnalysing(true);
    try {
      const res = await fetch('/api/style/analyse', { method: 'POST' });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? 'Analysis failed');
      }
      const { data } = (await res.json()) as { data: StyleProfile };
      setProfile(data);
      toast.success('Style analysis complete!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Analysis failed');
    } finally {
      setIsAnalysing(false);
    }
  }

  const platformEntries = profile ? Object.entries(profile.platformPreferences) : [];

  return (
    <div className="space-y-6">
      {/* Analyse button */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground text-sm">
            {profile
              ? `Last analysed: ${new Date(profile.analysedAt).toLocaleString()}`
              : 'No style profile yet. Add examples and run analysis.'}
          </p>
        </div>
        <Button onClick={handleAnalyse} disabled={isAnalysing || exampleCount === 0}>
          {isAnalysing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          {profile ? 'Re-analyse' : 'Analyse My Style'}
        </Button>
      </div>

      {isAnalysing && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-3 p-4">
            <Loader2 className="text-primary h-5 w-5 animate-spin" />
            <div>
              <p className="text-sm font-medium">Analysing your style...</p>
              <p className="text-muted-foreground text-xs">
                Claude is reading your examples. This may take 15–30 seconds.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!profile && !isAnalysing && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground text-sm">
              Your style profile will appear here after analysis.
            </p>
          </CardContent>
        </Card>
      )}

      {profile && !isAnalysing && (
        <div className="space-y-4">
          {/* Overview cards */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
                  Tone
                </p>
                <p className="font-medium capitalize">{profile.tone}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <ProfileBadge
                  label="Vocabulary"
                  value={VOCABULARY_LABELS[profile.vocabularyLevel] ?? profile.vocabularyLevel}
                />
                <ProfileBadge
                  label="Emoji Usage"
                  value={EMOJI_LABELS[profile.emojiUsage] ?? profile.emojiUsage}
                />
                <ProfileBadge
                  label="Hashtags"
                  value={HASHTAG_LABELS[profile.hashtagStyle] ?? profile.hashtagStyle}
                />
              </div>

              {profile.voiceCharacteristics.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                    Voice Characteristics
                  </p>
                  <TagList items={profile.voiceCharacteristics} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Content themes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Content Themes</CardTitle>
            </CardHeader>
            <CardContent>
              <TagList items={profile.contentThemes} />
            </CardContent>
          </Card>

          {/* Do / Don't lists */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle className="text-green-500 h-4 w-4" />
                  Do
                </CardTitle>
              </CardHeader>
              <CardContent>
                {profile.doList.length === 0 ? (
                  <p className="text-muted-foreground text-sm">None specified</p>
                ) : (
                  <ul className="space-y-1.5">
                    {profile.doList.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm">
                        <span className="text-green-500 mt-0.5">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <XCircle className="text-destructive h-4 w-4" />
                  Don&apos;t
                </CardTitle>
              </CardHeader>
              <CardContent>
                {profile.dontList.length === 0 ? (
                  <p className="text-muted-foreground text-sm">None specified</p>
                ) : (
                  <ul className="space-y-1.5">
                    {profile.dontList.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm">
                        <span className="text-destructive mt-0.5">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Platform preferences (collapsible) */}
          {platformEntries.length > 0 && (
            <Card>
              <CardHeader>
                <button
                  className="flex w-full items-center justify-between text-left"
                  onClick={() => setShowPlatformDetails((v) => !v)}
                  type="button"
                >
                  <CardTitle className="text-base">Platform Notes</CardTitle>
                  {showPlatformDetails ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              </CardHeader>
              {showPlatformDetails && (
                <CardContent className="space-y-3">
                  {platformEntries.map(([platform, notes]) => (
                    <div key={platform}>
                      <p className="text-sm font-medium capitalize">{platform}</p>
                      <p className="text-muted-foreground text-sm">{notes}</p>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
