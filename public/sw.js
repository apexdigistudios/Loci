const CACHE_NAME = "deloci-v3-shell";
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/offline.html",
  "/icon-192.png",
  "/icon-512.png",
  "/icon.png",
  "/apple-icon.png",
  "/apple-touch-icon.png",
  "/loci-light.png",
  "/loci-dark.png",
  "/logo.png",
  "/splash.png",
  "/hero.png",
  "/hero1.png",
  "/join-hero.png",
  "/lifestyle-group.png",
  "/founders.png",
  "/commute.png",
  "/meetup.png",
  "/travel.png",
  "/session-light.png",
  "/session-dark.png",
  "/banner/banner1.png",
  "/banner/banner2.png",
  "/banner/banner3.png",
  "/pages/emergency.png",
  "/pages/family.png",
  "/pages/besties.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(STATIC_ASSETS.map(async (asset) => {
      try {
        const response = await fetch(asset, { cache: "reload" });
        if (response.ok) await cache.put(asset, response);
      } catch {
        console.warn("[ServiceWorker] Could not pre-cache:", asset);
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

function isStaticAsset(request, url) {
  if (request.destination && ["script", "style", "image", "font", "worker"].includes(request.destination)) return true;
  return /\.(?:js|css|png|jpe?g|webp|svg|ico|woff2?|ttf|otf)$/i.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/data/")) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
          if (url.pathname === "/") await cache.put("/", response.clone());
        }
        return response;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        const exact = await cache.match(request);
        if (exact) return exact;
        const root = await cache.match("/");
        if (root) return root;
        const offline = await cache.match("/offline.html");
        if (offline) return offline;
        return new Response("Offline", {
          status: 503,
          statusText: "Service Unavailable",
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
    })());
    return;
  }

  if (isStaticAsset(request, url)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) {
        event.waitUntil(fetch(request).then((response) => {
          if (response.ok) return cache.put(request, response);
          return undefined;
        }).catch(() => undefined));
        return cached;
      }
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        return new Response("Offline asset unavailable", {
          status: 503,
          statusText: "Service Unavailable",
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
    })());
  }
});

self.addEventListener("push", (event) => {
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
    } catch {
      console.warn("[ServiceWorker] Could not read push payload");
    }

    const type = typeof payload.type === "string" ? payload.type : "update";
    const vibrate = type === "emergency" || type === "guardian_alert"
      ? [400, 100, 400, 100, 800]
      : type === "checkin"
      ? [100, 60, 100]
      : [180, 80, 180];
    const rawUrl = typeof payload.url === "string" ? payload.url : "/";
    let url = "/";
    try {
      const parsedUrl = new URL(rawUrl, self.location.origin);
      if (parsedUrl.origin === self.location.origin) url = `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
    } catch {
      url = "/";
    }

    await self.registration.showNotification(
      typeof payload.title === "string" ? payload.title : "Déloci Safety Alert",
      {
        body: typeof payload.body === "string" ? payload.body : "Safety update received.",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        vibrate,
        tag: typeof payload.tag === "string" ? payload.tag : "deloci-alert",
        data: { url },
        renotify: type === "emergency" || type === "guardian_alert",
      }
    );
  })().catch((error) => {
    console.error("[ServiceWorker] Push handling failed:", error);
  }));
});

self.addEventListener("sync", (event) => {
  if (event.tag !== "deloci-offline-sync") return;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (windows.length > 0) {
      await Promise.all(windows.map((client) => client.postMessage({ type: "FLUSH_OFFLINE_QUEUE" })));
    } else if (self.clients.openWindow) {
      await self.clients.openWindow("/main?sync=1");
    }
  })().catch((error) => {
    console.error("[ServiceWorker] Background sync failed:", error);
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const rawUrl = event.notification.data && event.notification.data.url;
  let targetUrl = new URL("/", self.location.origin);
  try {
    const candidate = new URL(typeof rawUrl === "string" ? rawUrl : "/", self.location.origin);
    if (candidate.origin === self.location.origin) targetUrl = candidate;
  } catch {
    targetUrl = new URL("/", self.location.origin);
  }

  event.waitUntil((async () => {
    const windowClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windowClients) {
      if (!("focus" in client)) continue;
      if (client.url === targetUrl.href) return client.focus();
      if ("navigate" in client) {
        const navigatedClient = await client.navigate(targetUrl.href);
        return navigatedClient ? navigatedClient.focus() : client.focus();
      }
    }
    return self.clients.openWindow ? self.clients.openWindow(targetUrl.href) : undefined;
  })().catch((error) => {
    console.error("[ServiceWorker] Notification click handling failed:", error);
  }));
});
