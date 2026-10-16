const CACHE_NAME = 'deloci-v2';
const STATIC_ASSETS = ['/', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(STATIC_ASSETS.map(async (asset) => {
      try {
        await cache.add(asset);
      } catch (error) {
        console.warn('[ServiceWorker] Skipped caching asset:', asset, error);
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    try {
      return await fetch(event.request);
    } catch (error) {
      try {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === 'navigate') {
          const home = await caches.match('/');
          if (home) return home;
        }
      } catch (cacheError) {
        console.warn('[ServiceWorker] Cache fallback failed:', cacheError);
      }
      return new Response('Offline', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  })());
});

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let payload = {};
    try {
      if (event.data) {
        const raw = event.data.text();
        try {
          payload = JSON.parse(raw);
        } catch {
          payload = { body: raw };
        }
      }
    } catch (error) {
      console.warn('[ServiceWorker] Could not read push payload:', error);
    }

    const type = typeof payload.type === 'string' ? payload.type : 'update';
    const vibrate = type === 'emergency' || type === 'guardian_alert'
      ? [400, 100, 400, 100, 800]
      : type === 'checkin'
      ? [100, 60, 100]
      : [180, 80, 180];
    const rawUrl = typeof payload.url === 'string' ? payload.url : '/';
    let url = '/';
    try {
      const parsedUrl = new URL(rawUrl, self.location.origin);
      if (parsedUrl.origin === self.location.origin) url = `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
    } catch {
      url = '/';
    }

    await self.registration.showNotification(
      typeof payload.title === 'string' ? payload.title : 'Déloci Safety Alert',
      {
        body: typeof payload.body === 'string' ? payload.body : 'Safety update received.',
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        vibrate,
        tag: typeof payload.tag === 'string' ? payload.tag : 'deloci-alert',
        data: { url },
        renotify: type === 'emergency' || type === 'guardian_alert',
      }
    );
  })().catch((error) => {
    console.error('[ServiceWorker] Push handling failed:', error);
  }));
});

self.addEventListener('sync', (event) => {
  if (event.tag !== 'deloci-offline-sync') return;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (windows.length > 0) {
      await Promise.all(windows.map((client) => client.postMessage({ type: 'FLUSH_OFFLINE_QUEUE' })));
    } else if (self.clients.openWindow) {
      await self.clients.openWindow('/main?sync=1');
    }
  })().catch((error) => {
    console.error('[ServiceWorker] Background sync failed:', error);
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const rawUrl = event.notification.data && event.notification.data.url;
  let targetUrl = new URL('/', self.location.origin);
  try {
    const candidate = new URL(typeof rawUrl === 'string' ? rawUrl : '/', self.location.origin);
    if (candidate.origin === self.location.origin) targetUrl = candidate;
  } catch {
    targetUrl = new URL('/', self.location.origin);
  }

  event.waitUntil((async () => {
    const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windowClients) {
      if (!('focus' in client)) continue;
      if (client.url === targetUrl.href) return client.focus();
      if ('navigate' in client) {
        const navigatedClient = await client.navigate(targetUrl.href);
        return navigatedClient ? navigatedClient.focus() : client.focus();
      }
    }
    return self.clients.openWindow ? self.clients.openWindow(targetUrl.href) : undefined;
  })().catch((error) => {
    console.error('[ServiceWorker] Notification click handling failed:', error);
  }));
});