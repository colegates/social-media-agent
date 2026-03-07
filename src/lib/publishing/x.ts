import { logger } from '@/lib/logger';
import type { IPublisher, PublishContent, PublishOptions, PublishResult } from './publisher.interface';
import { logPublishAttempt } from './publisher.interface';

/**
 * X (Twitter) publisher stub.
 * Currently provides "copy to clipboard" + pre-filled tweet intent URL.
 * Future stage: integrate X API v2 for direct tweeting.
 */
export class XPublisher implements IPublisher {
  readonly platform = 'x';

  async publish(content: PublishContent, options: PublishOptions = {}): Promise<PublishResult> {
    const pubLogger = logger.child({ publisher: 'x', contentId: content.id });
    pubLogger.info('X (Twitter) publish intent logged');

    const publishedAt = new Date();

    const tweetText = buildTweetText(content, options);

    await logPublishAttempt(content.id, content.userId, 'x', 'published');

    pubLogger.info({ contentId: content.id }, 'X publish logged to history');

    const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;

    return {
      success: true,
      platform: 'x',
      publishedAt,
      manualAction: {
        type: 'open_url',
        label: 'Open X to post tweet',
        value: intentUrl,
      },
    };
  }
}

function buildTweetText(content: PublishContent, options: PublishOptions): string {
  const body = options.caption ?? content.content ?? '';
  const hashtags = (options.hashtags ?? []).map((h) => `#${h.replace(/^#/, '')}`).join(' ');
  const combined = hashtags ? `${body}\n\n${hashtags}` : body;
  // X limit is 280 characters
  return combined.slice(0, 280);
}
