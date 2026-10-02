const CACHE_NAME = "loci-cache-v2";

self.addEventListener('install', (event) => {
  self.skipWaiting();
}); //[cite: 12]

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim(); //[cite: 12]
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data?.text() || 'A safety update is available.' };
  }

  const title = payload.title || 'Déloci Safety Alert';
  const options = {
    body: payload.body || 'A trusted contact shared a safety update.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200, 100, 400],
    requireInteraction: true,
    actions: [
      { action: 'view-live-session', title: 'View Live Session' },
      { action: 'call-guardian', title: 'Call Guardian' },
    ],
    data: {
      url: payload.url || (payload.sessionId
        ? `https://deloci.online/main?sharedSessionId=${encodeURIComponent(payload.sessionId)}`
        : 'https://deloci.online/main'),
      guardianPhone: payload.guardianPhone || '',
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};

  if (event.action === 'call-guardian' && data.guardianPhone) {
    event.waitUntil(
      self.clients.openWindow(`tel:${data.guardianPhone}`).catch(() => self.clients.openWindow('https://deloci.online/main'))
    );
    return;
  }

  let targetUrl = 'https://deloci.online/main';
  try {
    const requestedUrl = new URL(data.url || targetUrl, self.location.origin);
    if (requestedUrl.origin === self.location.origin) targetUrl = requestedUrl.href;
  } catch {
    targetUrl = 'https://deloci.online/main';
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existingClient = clients.find((client) => new URL(client.url).origin === self.location.origin);
      if (existingClient) {
        return existingClient.navigate(targetUrl).then((client) => (client || existingClient).focus());
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Standard network fetch for active tracking requests with cache fallback
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  ); //[cite: 12]
});