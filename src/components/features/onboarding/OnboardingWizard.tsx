'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Target,
  Palette,
  Bell,
  Key,
  Zap,
  SkipForward,
} from 'lucide-react';

interface OnboardingWizardProps {
  userName: string | null;
}

const TOTAL_STEPS = 7;

const STEP_META = [
  { icon: Sparkles, title: 'Welcome', description: 'Let\'s set up your account' },
  { icon: Target, title: 'First Topic', description: 'What trends do you want to track?' },
  { icon: Palette, title: 'Style Examples', description: 'Teach the AI your brand voice' },
  { icon: Sparkles, title: 'Style Analysis', description: 'Analyse your writing style' },
  { icon: Bell, title: 'Notifications', description: 'Stay informed about new trends' },
  { icon: Key, title: 'API Keys', description: 'Connect your services (optional)' },
  { icon: Zap, title: 'First Scan', description: 'Discover your first trends' },
];

export function OnboardingWizard({ userName }: OnboardingWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 2 state - topic
  const [topicName, setTopicName] = useState('');
  const [topicDesc, setTopicDesc] = useState('');
  const [topicKeywords, setTopicKeywords] = useState('');
  const [createdTopicId, setCreatedTopicId] = useState<string | null>(null);

  // Step 3 state - style examples
  const [styleContent, setStyleContent] = useState('');
  const [styleUrl, setStyleUrl] = useState('');
  const [addedExamples, setAddedExamples] = useState(0);

  // Step 4 state - analysis
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);

  // Step 5 state - notifications
  const [notifNewTrends, setNotifNewTrends] = useState(true);
  const [notifIdeasReady, setNotifIdeasReady] = useState(true);
  const [notifContentGen, setNotifContentGen] = useState(false);

  // Step 7 state - scan
  const [scanStarted, setScanStarted] = useState(false);

  function goNext() {
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 1));
  }

  async function markComplete() {
    await fetch('/api/user/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settings: {
          onboardingCompleted: true,
          notifications: {
            newTrends: notifNewTrends,
            ideasReady: notifIdeasReady,
            contentGenerated: notifContentGen,
          },
        },
      }),
    });
    router.push('/dashboard');
  }

  async function handleStep2Submit() {
    if (!topicName.trim()) {
      toast.error('Topic name is required');
      return;
    }
    setLoading(true);
    try {
      const keywords = topicKeywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);

      const res = await fetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: topicName,
          description: topicDesc,
          keywords: keywords.length > 0 ? keywords : [topicName],
          scanFrequencyMinutes: 60,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error ?? 'Failed to create topic');
        return;
      }

      const data = (await res.json()) as { data: { id: string } };
      setCreatedTopicId(data.data.id);
      toast.success('Topic created!');
      goNext();
    } catch {
      toast.error('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddStyleExample(type: 'text' | 'url') {
    const content = type === 'text' ? styleContent.trim() : styleUrl.trim();
    if (!content) {
      toast.error(type === 'text' ? 'Paste some content first' : 'Enter a URL first');
      return;
    }

    setLoading(true);
    try {
      const body =
        type === 'text'
          ? { type: 'social_post', content, platform: null }
          : { type: 'social_post', sourceUrl: content, content: `Content from: ${content}` };

      const res = await fetch('/api/style/examples', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setAddedExamples((n) => n + 1);
        if (type === 'text') setStyleContent('');
        else setStyleUrl('');
        toast.success('Example added!');
      } else {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error ?? 'Failed to add example');
      }
    } catch {
      toast.error('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  async function handleRunAnalysis() {
    if (addedExamples === 0) {
      toast.error('Add at least one style example first');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/style/analyse', { method: 'POST' });
      if (res.ok) {
        const data = (await res.json()) as { data: { tone?: string; voiceCharacteristics?: string[] } };
        const profile = data.data;
        setAnalysisResult(
          `Tone: ${profile.tone ?? 'balanced'} · Voice: ${(profile.voiceCharacteristics ?? []).slice(0, 3).join(', ')}`
        );
        toast.success('Style analysis complete!');
        goNext();
      } else {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error ?? 'Analysis failed');
      }
    } catch {
      toast.error('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  async function handleFirstScan() {
    if (!createdTopicId) {
      toast.info('Skipping scan — no topic created');
      await markComplete();
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/topics/${createdTopicId}/scan`, { method: 'POST' });
      if (res.ok) {
        setScanStarted(true);
        toast.success('Scan queued! Check your dashboard for results.');
      } else {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error ?? 'Scan failed to start');
      }
    } catch {
      toast.error('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  const progressPct = ((step - 1) / (TOTAL_STEPS - 1)) * 100;
  const StepIcon = STEP_META[step - 1].icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="bg-primary/10 mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full">
          <StepIcon className="text-primary h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold">{STEP_META[step - 1].title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{STEP_META[step - 1].description}</p>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">
            Step {step} of {TOTAL_STEPS}
          </span>
          <span className="text-muted-foreground">{Math.round(progressPct)}% complete</span>
        </div>
        <div className="bg-muted h-2 w-full rounded-full">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex gap-1">
          {STEP_META.map((s, i) => (
            <div
              key={s.title}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i + 1 < step
                  ? 'bg-primary'
                  : i + 1 === step
                    ? 'bg-primary/60'
                    : 'bg-muted'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Step content */}
      <Card>
        <CardContent className="pt-6">
          {step === 1 && <StepWelcome userName={userName} />}
          {step === 2 && (
            <StepTopic
              name={topicName}
              setName={setTopicName}
              desc={topicDesc}
              setDesc={setTopicDesc}
              keywords={topicKeywords}
              setKeywords={setTopicKeywords}
            />
          )}
          {step === 3 && (
            <StepStyle
              content={styleContent}
              setContent={setStyleContent}
              url={styleUrl}
              setUrl={setStyleUrl}
              addedCount={addedExamples}
              onAddText={() => handleAddStyleExample('text')}
              onAddUrl={() => handleAddStyleExample('url')}
              loading={loading}
            />
          )}
          {step === 4 && (
            <StepAnalysis
              addedCount={addedExamples}
              result={analysisResult}
              onAnalyse={handleRunAnalysis}
              loading={loading}
            />
          )}
          {step === 5 && (
            <StepNotifications
              newTrends={notifNewTrends}
              ideasReady={notifIdeasReady}
              contentGen={notifContentGen}
              setNewTrends={setNotifNewTrends}
              setIdeasReady={setNotifIdeasReady}
              setContentGen={setNotifContentGen}
            />
          )}
          {step === 6 && <StepApiKeys />}
          {step === 7 && (
            <StepFirstScan
              topicId={createdTopicId}
              scanStarted={scanStarted}
              onScan={handleFirstScan}
              loading={loading}
            />
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {step > 1 && (
            <Button variant="outline" onClick={goBack} size="sm">
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Skip button for optional steps (3, 4, 6, 7) */}
          {[3, 4, 6, 7].includes(step) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={step === 7 ? markComplete : goNext}
              disabled={loading}
            >
              <SkipForward className="mr-1 h-4 w-4" />
              Skip
            </Button>
          )}

          {/* Main action button */}
          {step === 1 && (
            <Button onClick={goNext}>
              Get started
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
          {step === 2 && (
            <Button onClick={handleStep2Submit} disabled={loading}>
              {loading ? 'Creating…' : 'Create topic'}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
          {step === 3 && (
            <Button onClick={goNext} variant="outline">
              Continue
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
          {step === 4 && analysisResult === null && (
            <Button onClick={handleRunAnalysis} disabled={loading || addedExamples === 0}>
              {loading ? 'Analysing…' : 'Analyse my style'}
              <Sparkles className="ml-1 h-4 w-4" />
            </Button>
          )}
          {step === 4 && analysisResult !== null && (
            <Button onClick={goNext}>
              Continue
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
          {step === 5 && (
            <Button onClick={goNext}>
              Save & continue
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
          {step === 6 && (
            <Button onClick={goNext}>
              Continue
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
          {step === 7 && !scanStarted && (
            <Button onClick={handleFirstScan} disabled={loading}>
              {loading ? 'Starting scan…' : 'Start first scan'}
              <Zap className="ml-1 h-4 w-4" />
            </Button>
          )}
          {step === 7 && scanStarted && (
            <Button onClick={markComplete}>
              Go to dashboard
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Step sub-components ───────────────────────────────────────────────────

function StepWelcome({ userName }: { userName: string | null }) {
  return (
    <div className="space-y-4 text-center">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">
          Welcome{userName ? `, ${userName}` : ''}! 👋
        </h2>
        <p className="text-muted-foreground text-sm">
          Social Media Agent helps you discover viral trends and generate ready-to-post content
          tailored to your brand voice — automatically.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 text-left sm:grid-cols-3">
        {[
          { emoji: '🔍', title: 'Scan trends', desc: 'Discover what\'s going viral on TikTok, Reddit, and Google' },
          { emoji: '💡', title: 'Get ideas', desc: 'AI curates and prioritises content ideas for you' },
          { emoji: '✨', title: 'Generate content', desc: 'Create images, videos, and copy in your brand style' },
        ].map((item) => (
          <div key={item.title} className="bg-muted/50 rounded-lg p-3">
            <div className="mb-1 text-2xl">{item.emoji}</div>
            <p className="font-medium text-sm">{item.title}</p>
            <p className="text-muted-foreground text-xs">{item.desc}</p>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        This quick setup takes about 3 minutes. You can skip any step.
      </p>
    </div>
  );
}

interface StepTopicProps {
  name: string; setName: (v: string) => void;
  desc: string; setDesc: (v: string) => void;
  keywords: string; setKeywords: (v: string) => void;
}

function StepTopic({ name, setName, desc, setDesc, keywords, setKeywords }: StepTopicProps) {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        A <strong>topic</strong> is a theme or niche you want to track trends for. For example:
        skincare, fitness, coffee, electric vehicles, or sustainable fashion.
      </p>

      <div className="space-y-2">
        <Label htmlFor="topic-name">Topic name *</Label>
        <Input
          id="topic-name"
          placeholder="e.g. Skincare & Beauty"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="topic-desc">Description</Label>
        <Textarea
          id="topic-desc"
          placeholder="Describe what kind of trends and content you want to find. Be specific — e.g. 'trending skincare routines, ingredient spotlights, and viral beauty hacks for Gen Z audiences'."
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="topic-keywords">Keywords (comma-separated)</Label>
        <Input
          id="topic-keywords"
          placeholder="e.g. skincare, retinol, glass skin, SPF, moisturiser"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
        />
        <p className="text-muted-foreground text-xs">
          These help the scanner find the most relevant trends.
        </p>
      </div>
    </div>
  );
}

interface StepStyleProps {
  content: string; setContent: (v: string) => void;
  url: string; setUrl: (v: string) => void;
  addedCount: number;
  onAddText: () => void;
  onAddUrl: () => void;
  loading: boolean;
}

function StepStyle({ content, setContent, url, setUrl, addedCount, onAddText, onAddUrl, loading }: StepStyleProps) {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Paste examples of your existing content so the AI can learn your brand voice, tone, and
        style. The more examples you add, the better the results.
      </p>

      {addedCount > 0 && (
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span className="text-sm font-medium text-green-700 dark:text-green-400">
            {addedCount} example{addedCount !== 1 ? 's' : ''} added
          </span>
        </div>
      )}

      <div className="space-y-2">
        <Label>Paste content</Label>
        <Textarea
          placeholder="Paste any post, caption, article excerpt, or brand guideline that represents your style…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={onAddText}
          disabled={loading || !content.trim()}
        >
          Add this example
        </Button>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="border-border w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-card text-muted-foreground px-2">or add by URL</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Content URL</Label>
        <div className="flex gap-2">
          <Input
            placeholder="https://www.instagram.com/p/... or any blog post URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={onAddUrl}
            disabled={loading || !url.trim()}
          >
            Add
          </Button>
        </div>
      </div>

      <p className="text-muted-foreground text-xs">
        Tip: Add 3–5 examples for best results. Go to{' '}
        <a href="/settings/style" className="text-primary underline" target="_blank">
          Settings → Style Profile
        </a>{' '}
        to add more later.
      </p>
    </div>
  );
}

interface StepAnalysisProps {
  addedCount: number;
  result: string | null;
  onAnalyse: () => void;
  loading: boolean;
}

function StepAnalysis({ addedCount, result, onAnalyse, loading }: StepAnalysisProps) {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Claude will analyse your examples and build a style profile. This ensures all generated
        content sounds authentically like you.
      </p>

      {addedCount === 0 && (
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <p className="text-muted-foreground text-sm">
            No style examples added yet.{' '}
            <button
              type="button"
              onClick={() => window.history.back()}
              className="text-primary underline"
            >
              Go back
            </button>{' '}
            to add some, or skip this step.
          </p>
        </div>
      )}

      {addedCount > 0 && result === null && (
        <div className="text-center">
          <Badge variant="outline" className="mb-3">
            {addedCount} example{addedCount !== 1 ? 's' : ''} ready for analysis
          </Badge>
          <p className="text-muted-foreground mb-4 text-sm">
            Click the button below to start the analysis. This usually takes 10–30 seconds.
          </p>
          <Button onClick={onAnalyse} disabled={loading} className="w-full">
            {loading ? (
              <>
                <div className="border-background mr-2 h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
                Analysing your style…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Analyse my style
              </>
            )}
          </Button>
        </div>
      )}

      {result !== null && (
        <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <p className="font-medium text-green-700 dark:text-green-400">Analysis complete!</p>
          </div>
          <p className="text-sm text-green-700 dark:text-green-400">{result}</p>
          <p className="text-muted-foreground text-xs">
            Your style profile is saved. View and edit it in{' '}
            <a href="/settings/style" className="text-primary underline" target="_blank">
              Settings → Style Profile
            </a>
            .
          </p>
        </div>
      )}
    </div>
  );
}

interface StepNotificationsProps {
  newTrends: boolean; setNewTrends: (v: boolean) => void;
  ideasReady: boolean; setIdeasReady: (v: boolean) => void;
  contentGen: boolean; setContentGen: (v: boolean) => void;
}

function StepNotifications({
  newTrends, setNewTrends,
  ideasReady, setIdeasReady,
  contentGen, setContentGen,
}: StepNotificationsProps) {
  const options = [
    {
      id: 'new-trends',
      label: 'New high-virality trends',
      description: 'When a trend scores above 70/100 in your topics',
      value: newTrends,
      onChange: setNewTrends,
    },
    {
      id: 'ideas-ready',
      label: 'Content ideas ready',
      description: 'After each scan generates new content ideas',
      value: ideasReady,
      onChange: setIdeasReady,
    },
    {
      id: 'content-gen',
      label: 'Content generation complete',
      description: 'When images, videos, or copy finish generating',
      value: contentGen,
      onChange: setContentGen,
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Choose when you want to be notified. You can change these at any time in Settings.
      </p>

      <div className="space-y-3">
        {options.map((opt) => (
          <div key={opt.id} className="flex items-start gap-3">
            <Switch
              id={opt.id}
              checked={opt.value}
              onCheckedChange={opt.onChange}
              className="mt-0.5"
            />
            <div>
              <Label htmlFor={opt.id} className="cursor-pointer font-medium">
                {opt.label}
              </Label>
              <p className="text-muted-foreground text-xs">{opt.description}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-muted-foreground text-xs">
        Push notifications require you to approve the permission in your browser when prompted.
      </p>
    </div>
  );
}

function StepApiKeys() {
  const services = [
    {
      name: 'Anthropic (Claude AI)',
      url: 'https://console.anthropic.com',
      desc: 'Powers AI trend scoring and content generation. Required for full functionality.',
      required: true,
    },
    {
      name: 'SerpAPI',
      url: 'https://serpapi.com/users/sign_up',
      desc: 'Scans Google Trends and YouTube for trending content.',
      required: false,
    },
    {
      name: 'Apify',
      url: 'https://console.apify.com/sign-up',
      desc: 'Scrapes TikTok and Instagram trends.',
      required: false,
    },
    {
      name: 'Replicate',
      url: 'https://replicate.com/signin',
      desc: 'Generates images for your social media posts.',
      required: false,
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Connect your own API keys to enable the full feature set. All keys are encrypted and stored
        securely.{' '}
        <a href="/settings/api-keys" className="text-primary underline" target="_blank">
          Set them up in Settings
        </a>{' '}
        — this step is optional.
      </p>

      <div className="space-y-2">
        {services.map((s) => (
          <div key={s.name} className="border-border flex items-start gap-3 rounded-lg border p-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm">{s.name}</p>
                {s.required && (
                  <Badge variant="outline" className="text-xs">
                    Recommended
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground mt-0.5 text-xs">{s.desc}</p>
            </div>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary shrink-0 text-xs underline"
            >
              Sign up
            </a>
          </div>
        ))}
      </div>

      <p className="text-muted-foreground text-xs">
        You can add and manage all API keys at any time in{' '}
        <a href="/settings/api-keys" className="text-primary underline" target="_blank">
          Settings → API Keys
        </a>
        .
      </p>
    </div>
  );
}

interface StepFirstScanProps {
  topicId: string | null;
  scanStarted: boolean;
  onScan: () => void;
  loading: boolean;
}

function StepFirstScan({ topicId, scanStarted, onScan, loading }: StepFirstScanProps) {
  return (
    <div className="space-y-4 text-center">
      {!scanStarted ? (
        <>
          <div className="text-4xl">🚀</div>
          <h3 className="text-lg font-semibold">You&apos;re all set!</h3>
          <p className="text-muted-foreground text-sm">
            {topicId
              ? "Kick things off by running your first trend scan. The scanner will check Google, TikTok, Reddit, and more for trending content in your topic."
              : "You're ready to go! Head to the dashboard to create your first topic and start scanning for trends."}
          </p>
          {topicId && (
            <Button onClick={onScan} disabled={loading} size="lg" className="w-full">
              {loading ? (
                <>
                  <div className="border-background mr-2 h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
                  Starting scan…
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Start first scan
                </>
              )}
            </Button>
          )}
        </>
      ) : (
        <>
          <div className="text-4xl">🎉</div>
          <h3 className="text-lg font-semibold">Scan is running!</h3>
          <p className="text-muted-foreground text-sm">
            Your first scan has been queued. Results will appear on your dashboard in a few minutes.
            You&apos;ll get a notification when trends are ready.
          </p>
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <strong>What happens next:</strong>
            <ol className="text-muted-foreground mt-2 list-decimal space-y-1 pl-4 text-xs text-left">
              <li>Trend scanner searches your topic across platforms</li>
              <li>AI scores each trend by virality and relevance</li>
              <li>Content ideas are generated from top trends</li>
              <li>You review and approve ideas in the feed</li>
            </ol>
          </div>
        </>
      )}
    </div>
  );
}
