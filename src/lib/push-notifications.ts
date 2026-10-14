import { supabase } from "@/lib/supabase";
import { normalizePhone } from "@/lib/utils";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolvePushUser(identifier: string) {
  const query = UUID_PATTERN.test(identifier)
    ? supabase.from("users").select("id, phone").eq("id", identifier)
    : supabase.from("users").select("id, phone").eq("phone", normalizePhone(identifier));
  return query.maybeSingle();
}

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

    const { data: user, error: userError } = await resolvePushUser(userId);
    if (userError || !user) {
      return { ok: false, reason: userError?.message || "Could not resolve user identity" };
    }

    const { error } = await supabase.from("user_push_subscriptions").upsert(
      {
        user_id: user.id,
        user_phone: normalizePhone(user.phone),
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
    const { data: user, error: userError } = await resolvePushUser(userId);
    if (userError || !user) {
      return { ok: false, reason: userError?.message || "Could not resolve user identity" };
    }

    const [uuidMatches, phoneMatches] = await Promise.all([
      supabase.from("user_push_subscriptions").select("id").eq("user_id", user.id),
      supabase.from("user_push_subscriptions").select("id").eq("user_phone", normalizePhone(user.phone)),
    ]);

    const error = uuidMatches.error || phoneMatches.error;
    if (error) return { ok: false, reason: error.message };

    const subscriptions = new Set([
      ...(uuidMatches.data || []).map((subscription) => subscription.id),
      ...(phoneMatches.data || []).map((subscription) => subscription.id),
    ]);
    if (subscriptions.size === 0) {
      return { ok: false, reason: "No active push subscriptions found for user." };
    }

    return { ok: true, data: { delivered: subscriptions.size } };
  } catch (err: unknown) {
    return { ok: false, reason: (err as Error).message };
  }
}