import Link from 'next/link';
import { buttonVariants } from '@/lib/button-variants';
import { Zap, TrendingUp, FileText, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function LandingPage() {
  return (
    <div className="bg-background flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-border border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Zap className="text-primary h-6 w-6" />
            <span className="text-lg font-semibold">Social Agent</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className={buttonVariants({ variant: 'ghost' })}>
              Sign in
            </Link>
            <Link href="/register" className={buttonVariants({ variant: 'default' })}>
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 py-20 text-center">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              AI-Powered Social Media <span className="text-primary">Trend Scanner</span>
            </h1>
            <p className="text-muted-foreground mt-6 text-lg sm:text-xl">
              Automatically scan social media for viral trends, curate content ideas, and generate
              ready-to-post content tailored to your brand voice.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/register"
                className={cn(buttonVariants({ variant: 'default', size: 'lg' }))}
              >
                Start for free
              </Link>
              <Link
                href="/login"
                className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}
              >
                Sign in
              </Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-border border-t">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <h2 className="mb-12 text-center text-3xl font-bold">
              Everything you need to stay ahead of trends
            </h2>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: TrendingUp,
                  title: 'Trend Scanning',
                  description:
                    'Monitor TikTok, Instagram, X, Reddit and more for viral content in your niche.',
                },
                {
                  icon: BarChart3,
                  title: 'Virality Scoring',
                  description:
                    'AI-powered scoring ranks trends by virality and relevance to your brand.',
                },
                {
                  icon: FileText,
                  title: 'Content Generation',
                  description:
                    'Generate images, videos, and copy that match your unique brand voice.',
                },
                {
                  icon: Zap,
                  title: 'Automation',
                  description:
                    'Set up rules to auto-scan, curate, and generate content on autopilot.',
                },
              ].map((feature) => {
                const Icon = feature.icon;
                return (
                  <div key={feature.title} className="text-center">
                    <div className="bg-primary/10 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg">
                      <Icon className="text-primary h-6 w-6" />
                    </div>
                    <h3 className="mb-2 font-semibold">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm">{feature.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-border text-muted-foreground border-t py-8 text-center text-sm">
        <p>&copy; {new Date().getFullYear()} Social Media Agent. All rights reserved.</p>
      </footer>
    </div>
  );
}
