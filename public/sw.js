// EMTChat Service Worker
// Version: 1.0.0
// Uses Workbox for caching strategies

importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

// Configure Workbox
workbox.setConfig({
  debug: false,
});

const { precaching, routing, strategies, expiration, backgroundSync } = workbox;
const { registerRoute, setDefaultHandler, setCatchHandler } = routing;
const { CacheFirst, NetworkFirst, StaleWhileRevalidate } = strategies;
const { ExpirationPlugin } = expiration;

// Cache names with versioning
const CACHE_VERSION = 'v1';
const STATIC_CACHE = `emtchat-static-${CACHE_VERSION}`;
const API_CACHE = `emtchat-api-${CACHE_VERSION}`;
const IMAGE_CACHE = `emtchat-images-${CACHE_VERSION}`;
const DOCUMENT_CACHE = `emtchat-docs-${CACHE_VERSION}`;

// Clean up old caches on activation
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return cacheName.startsWith('emtchat-') && !cacheName.endsWith(CACHE_VERSION);
          })
          .map((cacheName) => caches.delete(cacheName))
      );
    })
  );
});

// Handle skip waiting message from UpdatePrompt component
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Static assets - Cache First (JS, CSS, fonts)
registerRoute(
  ({ request }) =>
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font',
  new CacheFirst({
    cacheName: STATIC_CACHE,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  })
);

// Next.js static assets
registerRoute(
  ({ url }) => url.pathname.startsWith('/_next/static/'),
  new CacheFirst({
    cacheName: STATIC_CACHE,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  })
);

// Images - Stale While Revalidate
registerRoute(
  ({ request }) => request.destination === 'image',
  new StaleWhileRevalidate({
    cacheName: IMAGE_CACHE,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
      }),
    ],
  })
);

// API requests - Network First (excluding Socket.IO and real-time)
registerRoute(
  ({ url }) =>
    url.pathname.startsWith('/api/') &&
    !url.pathname.includes('/socket') &&
    !url.pathname.includes('/chat/send'),
  new NetworkFirst({
    cacheName: API_CACHE,
    networkTimeoutSeconds: 10,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 5 * 60, // 5 minutes
      }),
    ],
  })
);

// Documents (PDF, DOCX, etc) - Cache First
registerRoute(
  ({ url }) =>
    url.pathname.startsWith('/api/documents/') ||
    url.pathname.match(/\.(pdf|docx|xlsx|pptx)$/i),
  new CacheFirst({
    cacheName: DOCUMENT_CACHE,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
      }),
    ],
  })
);

// Default handler - Network First for navigation
setDefaultHandler(new NetworkFirst());

// Offline fallback for navigation requests
setCatchHandler(async ({ event }) => {
  if (event.request.destination === 'document') {
    // Return offline page for navigation requests
    const cache = await caches.open(STATIC_CACHE);
    const offlinePage = await cache.match('/offline');
    if (offlinePage) {
      return offlinePage;
    }
    // Fallback to a simple offline response
    return new Response(
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EMTChat - Offline</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #1a1a1a;
      color: #fff;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    h1 { color: #eab308; margin-bottom: 1rem; }
    p { color: #888; margin-bottom: 2rem; }
    button {
      background: #eab308;
      color: #000;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 0.5rem;
      font-weight: 600;
      cursor: pointer;
    }
    button:hover { background: #ca9d07; }
  </style>
</head>
<body>
  <div class="container">
    <h1>You're Offline</h1>
    <p>EMTChat requires an internet connection.</p>
    <button onclick="window.location.reload()">Try Again</button>
  </div>
</body>
</html>`,
      {
        headers: { 'Content-Type': 'text/html' },
      }
    );
  }

  // For other requests, return a network error
  return Response.error();
});

// Push notification handler (stub for future implementation)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'New notification from EMTChat',
      icon: '/gk_logo_new.png',
      badge: '/gk_logo_new.png',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/',
      },
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'EMTChat', options)
    );
  } catch (error) {
    console.error('Push notification error:', error);
  }
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Background sync for offline message queue (stub for future implementation)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncOfflineMessages());
  }
});

async function syncOfflineMessages() {
  // This will be implemented with IndexedDB in Step 12
  console.log('[SW] Background sync triggered for messages');
}

console.log('[SW] EMTChat Service Worker loaded');
