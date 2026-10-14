const CACHE_NAME = 'deloci-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.json'
];

// Install event - safe individual asset caching
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const asset of STATIC_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn(`[ServiceWorker] Skipped caching failed asset: ${asset}`, err);
        }
      }
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches and claim control
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - network first, falling back to cache
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .catch(() => {
        return (async () => {
          try {
            const cachedResponse = await caches.match(event.request);
            if (cachedResponse) return cachedResponse;

            if (event.request.mode === 'navigate') {
              const cachedHome = await caches.match('/');
              if (cachedHome) return cachedHome;
            }
          } catch (error) {
            console.warn('[ServiceWorker] Cache fallback failed:', error);
          }

          return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        })();
      })
  );
});

// Push notification event listener
self.addEventListener('push', (event) => {
  let data = { title: 'Déloci Safety Alert', body: 'Safety update received.' };
  try {
    if (event.data) {
      const payload = event.data.json();
      if (payload && typeof payload === 'object') data = payload;
    }
  } catch (error) {
    console.warn('[ServiceWorker] Could not parse push payload:', error);
  }

  const options = {
    body: data.body || data.message || 'Safety update received.',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' },
    tag: data.tag || 'deloci-alert'
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Déloci Safety Alert', options)
  );
});

// Notification click event listener
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});