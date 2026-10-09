const CACHE_NAME = "deloci-cache-v1";
const OFFLINE_URL = "/offline.html";

// 1. INSTALLATION: Pre-cache offline page & skip waiting
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL))
  );
  self.skipWaiting();
});

// 2. ACTIVATION: Clean up old caches & claim clients immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    ).then(() => clients.claim())
  );
});

// 3. FETCH INTERCEPTION: Serve offline.html when network drops during navigation
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    );
  }
});

// 4. PUSH NOTIFICATION: Receive & display safety alerts
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {
    title: "Déloci Safety Alert",
    body: "Safety check-in required",
    url: "/",
    tag: "deloci-safety-alert",
  };

  try {
    payload = event.data.json();
  } catch (e) {
    payload.body = event.data.text();
  }

  const options = {
    body: payload.body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: [300, 100, 300, 100, 300],
    tag: payload.tag || "deloci-safety-alert",
    renotify: true,
    requireInteraction: true,
    data: { url: payload.url || "/" },
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || "Déloci Safety Alert", options)
  );
});

// 5. NOTIFICATION CLICK: Focus existing tab or open target route
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const relativeUrl = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      const targetUrl = new URL(relativeUrl, self.location.origin).href;

      for (const client of windowClients) {
        if (client.url === targetUrl && "focus" in client) {
          return client.focus();
        }
      }

      if (windowClients.length > 0 && "focus" in windowClients[0]) {
        const client = windowClients[0];
        if ("navigate" in client) {
          client.navigate(targetUrl);
        }
        return client.focus();
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});