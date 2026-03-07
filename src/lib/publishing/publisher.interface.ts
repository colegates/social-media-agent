import { db } from '@/db';
import { publishHistory } from '@/db/schema';
import type { PublishStatus } from '@/db/schema';

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export interface PublishContent {
  id: string;
  userId: string;
  type: string;
  content?: string | null;
  storageUrl?: string | null;
  thumbnailUrl?: string | null;
  metadata: Record<string, unknown>;
}

export interface PublishOptions {
  caption?: string;
  hashtags?: string[];
  scheduledFor?: Date;
}

export interface PublishResult {
  success: boolean;
  platform: string;
  externalId?: string;
  publishedAt: Date;
  errorMessage?: string;
  /** URL or instructions for manual publishing */
  manualAction?: {
    type: 'copy_clipboard' | 'open_url';
    label: string;
    value: string;
  };
}

// ─────────────────────────────────────────────────────────
// Interface
// ─────────────────────────────────────────────────────────

export interface IPublisher {
  readonly platform: string;
  publish(content: PublishContent, options?: PublishOptions): Promise<PublishResult>;
}

// ─────────────────────────────────────────────────────────
// Log publish attempt to DB
// ─────────────────────────────────────────────────────────

export async function logPublishAttempt(
  contentId: string,
  userId: string,
  platform: string,
  status: PublishStatus,
  externalId?: string,
  errorMessage?: string
): Promise<void> {
  await db.insert(publishHistory).values({
    contentId,
    userId,
    platform,
    publishedAt: new Date(),
    externalId: externalId ?? null,
    status,
    errorMessage: errorMessage ?? null,
  });
}
