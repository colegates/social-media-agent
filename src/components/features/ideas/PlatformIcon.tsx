import { Instagram, Linkedin, FileText, Youtube } from 'lucide-react';
import type { ContentIdeaPlatform } from '@/db/schema';

interface PlatformIconProps {
  platform: ContentIdeaPlatform;
  className?: string;
}

// Simple SVG icons for platforms without Lucide equivalents
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.31 6.31 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.75a8.23 8.23 0 004.81 1.54V6.84a4.85 4.85 0 01-1.04-.15z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const PLATFORM_CONFIG: Record<
  ContentIdeaPlatform,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  instagram_post: { label: 'Instagram Post', color: 'text-pink-500', icon: Instagram },
  instagram_reel: { label: 'Instagram Reel', color: 'text-pink-600', icon: Instagram },
  tiktok: { label: 'TikTok', color: 'text-slate-800 dark:text-slate-200', icon: TikTokIcon },
  x_post: { label: 'X Post', color: 'text-slate-700 dark:text-slate-300', icon: XIcon },
  x_thread: { label: 'X Thread', color: 'text-slate-700 dark:text-slate-300', icon: XIcon },
  linkedin: { label: 'LinkedIn', color: 'text-blue-600', icon: Linkedin },
  blog: { label: 'Blog', color: 'text-orange-500', icon: FileText },
  youtube_short: { label: 'YouTube Short', color: 'text-red-500', icon: Youtube },
};

export function PlatformIcon({ platform, className = 'h-4 w-4' }: PlatformIconProps) {
  const config = PLATFORM_CONFIG[platform];
  const Icon = config.icon;
  return <Icon className={`${className} ${config.color}`} />;
}

export function getPlatformLabel(platform: ContentIdeaPlatform): string {
  return PLATFORM_CONFIG[platform]?.label ?? platform;
}

export function getPlatformColor(platform: ContentIdeaPlatform): string {
  return PLATFORM_CONFIG[platform]?.color ?? 'text-muted-foreground';
}

export const PLATFORM_BG_COLORS: Record<ContentIdeaPlatform, string> = {
  instagram_post: 'bg-pink-50 dark:bg-pink-950/20 border-pink-200 dark:border-pink-800',
  instagram_reel: 'bg-pink-50 dark:bg-pink-950/20 border-pink-200 dark:border-pink-800',
  tiktok: 'bg-slate-50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-700',
  x_post: 'bg-slate-50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-700',
  x_thread: 'bg-slate-50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-700',
  linkedin: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800',
  blog: 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800',
  youtube_short: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800',
};

export { PLATFORM_CONFIG };
