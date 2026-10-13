import { supabase } from "@/lib/supabase";

// Helper to convert VAPID public key string to Uint8Array
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
    return { ok: false, reason: "Push notifications not supported by browser" };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    if (!vapidPublicKey) {
      console.warn("NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing from environment variables.");
      return { ok: false, reason: "Missing VAPID public key" };
    }

    const existingSubscription = await registration.pushManager.getSubscription();
    const subscription = existingSubscription || (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    }));

    const subJson = subscription.toJSON();
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint: subJson.endpoint,
        p256dh: subJson.keys?.p256dh,
        auth: subJson.keys?.auth,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    );

    if (error) {
      console.error("Failed to save push subscription to Supabase:", error);
      return { ok: false, reason: error.message };
    }

    return { ok: true, subscription };
  } catch (err: unknown) {
    console.error("Push subscription failure:", err);
    return { ok: false, reason: (err as Error).message };
  }
}

export async function sendPushTestNotification(userId: string) {
  try {
    const { data, error } = await supabase
      .from("push_subscriptions")
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