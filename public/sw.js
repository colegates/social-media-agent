// Social Media Agent — Service Worker
// Handles push notifications and caching

const CACHE_NAME = 'social-agent-v1';
const OFFLINE_URL = '/offline';

// ─────────────────────────────────────────────────────────
// Install & Activate
// ─────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(['/dashboard', '/notifications', '/content/review'])
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

// ─────────────────────────────────────────────────────────
// Push notification received
// ─────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Social Agent', body: event.data.text(), data: {} };
  }

  const { title, body, data = {} } = payload;

  const options = {
    body,
    icon: '/icon.png',
    badge: '/icon.png',
    data,
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
    requireInteraction: false,
    tag: data.type || 'general',
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ─────────────────────────────────────────────────────────
// Notification click handling
// ─────────────────────────────────────────────────────────

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const data = event.notification.data || {};
  const url = data.url || '/dashboard';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if already open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            client.navigate(url);
            return;
          }
        }
        // Otherwise open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
  );
});

// ─────────────────────────────────────────────────────────
// Fetch (network-first with cache fallback for navigation)
// ─────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request).then((r) => r || caches.match(OFFLINE_URL))
      )
    );
  }
});
