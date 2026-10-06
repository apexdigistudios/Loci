import { supabase } from "@/lib/supabase";

function decodeVapidKey(encodedKey: string) {
  const padding = "=".repeat((4 - (encodedKey.length % 4)) % 4);
  const base64 = (encodedKey + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export async function subscribeUserToPush(userId: string) {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return { ok: false as const, reason: "unsupported" as const };
  }

  let permission: NotificationPermission;
  try {
    permission = Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;
  } catch (error) {
    console.error("Could not request notification permission:", error);
    return { ok: false as const, reason: "permission-request-failed" as const };
  }
  if (permission !== "granted") return { ok: false as const, reason: "permission-denied" as const };
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false as const, reason: "unsupported" as const };
  }

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) return { ok: false as const, reason: "missing-vapid-key" as const };

  try {
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("phone")
      .eq("id", userId)
      .maybeSingle();
    if (userError || !user) {
      console.error("Could not find the user for push registration:", userError);
      return { ok: false as const, reason: "user-not-found" as const };
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({
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
      .upsert({
        user_id: userId,
        user_phone: user.phone,
        endpoint: subscription.endpoint,
        p256dh,
        auth,
      }, { onConflict: "endpoint" });

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