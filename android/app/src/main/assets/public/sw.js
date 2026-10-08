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

self.addEventListener('fetch', (event) => {
  // Standard network fetch for active tracking requests with cache fallback
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  ); //[cite: 12]
});