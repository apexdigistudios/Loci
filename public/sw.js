self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = { title: "Déloci Alert", body: "Safety check-in notification", url: "/", tag: "loci-alert" };
  try {
    payload = event.data.json();
  } catch (e) {
    payload.body = event.data.text();
  }

  const options = {
    body: payload.body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: [200, 100, 200, 100, 200],
    tag: payload.tag || "loci-alert",
    renotify: true,
    data: { url: payload.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(payload.title || "Déloci Alert", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === urlToOpen && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});