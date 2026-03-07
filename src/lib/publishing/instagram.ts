import { logger } from '@/lib/logger';
import type { IPublisher, PublishContent, PublishOptions, PublishResult } from './publisher.interface';
import { logPublishAttempt } from './publisher.interface';

/**
 * Instagram publisher stub.
 * Currently provides "copy to clipboard" + "open platform" UX.
 * Future stage: integrate Meta Graph API for direct posting.
 */
export class InstagramPublisher implements IPublisher {
  readonly platform = 'instagram';

  async publish(content: PublishContent, options: PublishOptions = {}): Promise<PublishResult> {
    const pubLogger = logger.child({ publisher: 'instagram', contentId: content.id });
    pubLogger.info('Instagram publish intent logged');

    const caption = buildCaption(content, options);
    const publishedAt = new Date();

    await logPublishAttempt(content.id, content.userId, 'instagram', 'published');

    pubLogger.info({ contentId: content.id }, 'Instagram publish logged to history');

    return {
      success: true,
      platform: 'instagram',
      publishedAt,
      manualAction: {
        type: 'open_url',
        label: 'Open Instagram to post',
        value: 'https://www.instagram.com/create/story',
      },
    };
  }
}

function buildCaption(content: PublishContent, options: PublishOptions): string {
  const parts: string[] = [];
  if (options.caption) parts.push(options.caption);
  else if (content.content) parts.push(content.content);
  if (options.hashtags && options.hashtags.length > 0) {
    parts.push(options.hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' '));
  }
  return parts.join('\n\n');
}
