import { logger } from '@/lib/logger';
import type { IPublisher, PublishContent, PublishOptions, PublishResult } from './publisher.interface';
import { logPublishAttempt } from './publisher.interface';

/**
 * LinkedIn publisher stub.
 * Currently provides "copy to clipboard" + "open platform" UX.
 * Future stage: integrate LinkedIn Share API v2.
 */
export class LinkedInPublisher implements IPublisher {
  readonly platform = 'linkedin';

  async publish(content: PublishContent, options: PublishOptions = {}): Promise<PublishResult> {
    const pubLogger = logger.child({ publisher: 'linkedin', contentId: content.id });
    pubLogger.info('LinkedIn publish intent logged');

    const publishedAt = new Date();

    const postText = [
      options.caption ?? content.content ?? '',
      ...(options.hashtags ?? []).map((h) => `#${h.replace(/^#/, '')}`),
    ]
      .join('\n\n')
      .trim();

    await logPublishAttempt(content.id, content.userId, 'linkedin', 'published');

    pubLogger.info({ contentId: content.id }, 'LinkedIn publish logged to history');

    return {
      success: true,
      platform: 'linkedin',
      publishedAt,
      manualAction: {
        type: 'copy_clipboard',
        label: 'Copy post for LinkedIn',
        value: postText,
      },
    };
  }
}
