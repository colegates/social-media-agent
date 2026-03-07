import { logger } from '@/lib/logger';
import type { IPublisher, PublishContent, PublishOptions, PublishResult } from './publisher.interface';
import { logPublishAttempt } from './publisher.interface';

/**
 * TikTok publisher stub.
 * Currently provides "copy to clipboard" + "open platform" UX.
 * Future stage: integrate TikTok Content Posting API.
 */
export class TikTokPublisher implements IPublisher {
  readonly platform = 'tiktok';

  async publish(content: PublishContent, options: PublishOptions = {}): Promise<PublishResult> {
    const pubLogger = logger.child({ publisher: 'tiktok', contentId: content.id });
    pubLogger.info('TikTok publish intent logged');

    const publishedAt = new Date();

    await logPublishAttempt(content.id, content.userId, 'tiktok', 'published');

    pubLogger.info({ contentId: content.id }, 'TikTok publish logged to history');

    const caption = [
      options.caption ?? content.content ?? '',
      ...(options.hashtags ?? []).map((h) => `#${h.replace(/^#/, '')}`),
    ]
      .join(' ')
      .trim();

    return {
      success: true,
      platform: 'tiktok',
      publishedAt,
      manualAction: {
        type: 'copy_clipboard',
        label: 'Copy caption for TikTok',
        value: caption,
      },
    };
  }
}
