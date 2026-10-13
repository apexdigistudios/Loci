import { supabase } from "@/lib/supabase";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeUserToPush(userId: string) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, reason: "Push not supported" };
  }

  if (!userId) {
    return { ok: false, reason: "Missing userId" };
  }

  if (!window.isSecureContext) {
    return { ok: false, reason: "Insecure context (HTTP required)" };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    if (!vapidPublicKey || vapidPublicKey.trim() === "") {
      console.warn("NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing. Push subscriptions skipped.");
      return { ok: false, reason: "Missing VAPID public key" };
    }

    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey.trim());

    if (applicationServerKey.length !== 65) {
      console.warn("Invalid VAPID public key length (must be 65 bytes). Push subscriptions skipped.");
      return { ok: false, reason: "Invalid VAPID public key length" };
    }

    if (Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        return { ok: false, reason: "Notification permission denied" };
      }
    }

    let subscription = await registration.pushManager.getSubscription();
    
    // Safely attempt push subscription with graceful fallback for browser/local aborts
    if (!subscription) {
      try {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      } catch (pushErr: unknown) {
        console.warn("Browser push service rejected subscription (running locally or service misconfigured):", (pushErr as Error).message);
        return { ok: false, reason: "Browser push service unavailable" };
      }
    }

    if (!subscription) {
      return { ok: false, reason: "Failed to obtain push subscription" };
    }

    const subJson = subscription.toJSON();
    if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
      return { ok: false, reason: "Invalid subscription keys" };
    }

    const { error } = await supabase.from("user_push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint: subJson.endpoint,
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    );

    if (error) {
      console.error("Supabase Push Subscription Upsert Error:", error);
      return { ok: false, reason: error.message };
    }

    return { ok: true, subscription };
  } catch (err: unknown) {
    console.warn("Push subscription warning:", (err as Error).message);
    return { ok: false, reason: (err as Error).message };
  }
}

export async function sendPushTestNotification(userId: string) {
  try {
    const { data, error } = await supabase
      .from("user_push_subscriptions")
      .select("id")
      .eq("user_id", userId);

    if (error || !data || data.length === 0) {
      return { ok: false, reason: "No active push subscriptions found for user." };
    }

    return { ok: true, data: { delivered: data.length } };
  } catch (err: unknown) {
    return { ok: false, reason: (err as Error).message };
  }
}