type SubscriptionResult =
  | { ok: true; subscription: PushSubscription }
  | { ok: false; reason: string };

type TestPushResult =
  | { ok: true; data: { delivered?: number; [key: string]: unknown } }
  | { ok: false; reason: string };

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("Push messaging is not supported in this browser.");
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    return registration;
  } catch (error) {
    console.error("Service Worker registration failed:", error);
    return null;
  }
}

export async function subscribeUserToPush(userId: string): Promise<SubscriptionResult> {
  const registration = await registerServiceWorker();
  if (!registration) return { ok: false, reason: "Service Workers unsupported" };

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    console.error("NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing.");
    return { ok: false, reason: "Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY" };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { ok: false, reason: "Permission denied by browser" };
    }

    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const convertedKey = urlBase64ToUint8Array(vapidPublicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey as unknown as BufferSource,
      });
    }

    const subJson = subscription.toJSON();
    const endpoint = subJson.endpoint;
    const p256dh = subJson.keys?.p256dh;
    const auth = subJson.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      return { ok: false, reason: "Invalid browser subscription keys" };
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const response = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        action: "subscribe",
        user_id: userId,
        endpoint,
        p256dh,
        auth,
        device_info: { userAgent: navigator.userAgent },
      }),
    });

    const resData = await response.json().catch(() => ({})) as { error?: string; [key: string]: unknown };

    if (!response.ok || resData.error) {
      console.error("Edge function subscribe error:", resData);
      return { ok: false, reason: resData.error || `HTTP ${response.status}` };
    }

    return { ok: true, subscription };
  } catch (error: unknown) {
    console.error("Push subscription failed:", error);
    return { ok: false, reason: error instanceof Error ? error.message : "Subscription error" };
  }
}

export async function sendTestPushNotification(userId: string): Promise<TestPushResult> {
  // 1. Ensure user is subscribed first
  const subResult = await subscribeUserToPush(userId);
  if (!subResult.ok) {
    return subResult;
  }

  // 2. Dispatch the test push
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        action: "test",
        user_id: userId,
        title: "Déloci Test Notification 🔔",
        body: "Web Push pipeline is active and working!",
      }),
    });

    const resData = await response.json().catch(() => ({})) as { error?: string; delivered?: number; [key: string]: unknown };

    if (!response.ok || resData.error) {
      console.error("Test push dispatch error:", resData);
      return { ok: false, reason: resData.error || `HTTP ${response.status}` };
    }

    return { ok: true, data: resData };
  } catch (error: unknown) {
    return { ok: false, reason: error instanceof Error ? error.message : "Network request failed" };
  }
}

export const sendPushTestNotification = sendTestPushNotification;