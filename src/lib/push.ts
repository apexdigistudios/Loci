import { supabase } from "@/lib/supabase";
import { requestNotificationPermission } from "@/lib/notifications";

function decodeVapidKey(encodedKey: string) {
  const padding = "=".repeat((4 - (encodedKey.length % 4)) % 4);
  const base64 = (encodedKey + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export async function subscribeToPush(userPhone: string) {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false as const, reason: "unsupported" as const };
  }

  const permission = await requestNotificationPermission();
  if (permission !== "granted") return { ok: false as const, reason: "permission-denied" as const };

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) return { ok: false as const, reason: "missing-vapid-key" as const };

  try {
    const registration = await navigator.serviceWorker.ready;
    const pushManager = registration.pushManager;
    const subscription = await pushManager.getSubscription() || await pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeVapidKey(vapidKey),
    });
    const serialized = subscription.toJSON();
    const p256dh = serialized.keys?.p256dh;
    const auth = serialized.keys?.auth;
    if (!subscription.endpoint || !p256dh || !auth) {
      return { ok: false as const, reason: "invalid-subscription" as const };
    }

    const { error } = await supabase
      .from("user_push_subscriptions")
      .upsert({ user_phone: userPhone, endpoint: subscription.endpoint, p256dh, auth }, { onConflict: "endpoint" });

    if (error) {
      console.error("Could not store push subscription:", error);
      return { ok: false as const, reason: "storage-failed" as const };
    }
    return { ok: true as const, subscription };
  } catch (error) {
    console.error("Push subscription failed:", error);
    return { ok: false as const, reason: "subscription-failed" as const };
  }
}