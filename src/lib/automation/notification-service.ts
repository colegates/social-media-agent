import webpush from 'web-push';
import { db } from '@/db';
import { notifications, pushSubscriptions } from '@/db/schema';
import type { NotificationType, NewNotification } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';

// ─────────────────────────────────────────────────────────
// VAPID Configuration
// ─────────────────────────────────────────────────────────

function configurePushVapid(): void {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    logger.warn(
      { hasPublicKey: !!publicKey, hasPrivateKey: !!privateKey, hasSubject: !!subject },
      'VAPID keys not fully configured — push notifications disabled'
    );
    return;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
}

// Initialise at module load (no-op if keys missing)
configurePushVapid();

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export interface NotificationData {
  url?: string;
  topicId?: string;
  contentId?: string;
  ideaId?: string;
  [key: string]: unknown;
}

export interface SendNotificationOptions {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: NotificationData;
}

// ─────────────────────────────────────────────────────────
// Core send function
// ─────────────────────────────────────────────────────────

export async function sendNotification(options: SendNotificationOptions): Promise<void> {
  const { userId, type, title, body, data = {} } = options;

  const notifLogger = logger.child({ userId, notificationType: type });
  notifLogger.info({ title }, 'Sending in-app notification');

  // 1. Persist in-app notification
  const newNotif: NewNotification = {
    userId,
    type,
    title,
    body,
    data,
    isRead: false,
  };

  const [inserted] = await db.insert(notifications).values(newNotif).returning({ id: notifications.id });
  notifLogger.debug({ notificationId: inserted?.id }, 'In-app notification inserted');

  // 2. Push web push notification if VAPID configured and user has subscriptions
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    return;
  }

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  if (subs.length === 0) {
    notifLogger.debug('No push subscriptions for user');
    return;
  }

  const payload = JSON.stringify({ title, body, data });

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dhKey, auth: sub.authKey },
          },
          payload,
          { TTL: 60 * 60 * 24 } // 24 hours
        );
        notifLogger.debug({ endpoint: sub.endpoint.slice(0, 40) }, 'Push notification sent');
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 410 || statusCode === 404) {
          // Subscription expired — remove it
          notifLogger.info({ endpoint: sub.endpoint.slice(0, 40) }, 'Removing expired push subscription');
          await db
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.id, sub.id));
        } else {
          notifLogger.warn({ err, endpoint: sub.endpoint.slice(0, 40) }, 'Failed to send push notification');
        }
      }
    })
  );
}
