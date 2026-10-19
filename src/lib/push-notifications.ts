import { supabase } from "@/lib/supabase";
import { invokeNotificationApi } from "@/lib/notification-api";
import { getFriendlyErrorMessage } from "@/lib/friendly-errors";

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
    return { ok: false, reason: "Notifications aren’t available in this browser. You can still use Déloci as usual." };
  }

  if (!userId) {
    return { ok: false, reason: "Your profile is still loading. Please try again in a moment." };
  }

  if (!window.isSecureContext) {
    return { ok: false, reason: "Notifications need a secure connection. Open Déloci from its usual app or website address." };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    if (!vapidPublicKey || vapidPublicKey.trim() === "") {
      console.warn("NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing. Push subscriptions skipped.");
      return { ok: false, reason: "Push notifications aren’t configured on this app yet. You can still use Déloci normally." };
    }

    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey.trim());

    if (applicationServerKey.length !== 65) {
      console.warn("Invalid VAPID public key length (must be 65 bytes). Push subscriptions skipped.");
      return { ok: false, reason: "We couldn’t set up notifications on this device. Please try again later." };
    }

    if (Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        return { ok: false, reason: "Notifications are turned off. You can enable them in your device settings." };
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
        console.warn("Browser push subscription was unavailable:", pushErr);
        return { ok: false, reason: "Your browser couldn’t enable notifications right now. Please try again later." };
      }
    }

    if (!subscription) {
      return { ok: false, reason: "We couldn’t enable notifications on this device. Please try again." };
    }

      const p256dh = subscription.getKey("p256dh");
      const auth = subscription.getKey("auth");
      if (!subscription.endpoint || !p256dh || !auth) {
      return { ok: false, reason: "We couldn’t enable notifications on this device. Please try again." };
    }

      const { error } = await supabase.from("user_push_subscriptions").upsert({
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: arrayBufferToBase64(p256dh),
        auth: arrayBufferToBase64(auth),
        device_info: {
          userAgent: navigator.userAgent,
          language: navigator.language,
          platform: navigator.platform,
        },
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,endpoint" });
      if (error) throw error;

    return { ok: true, subscription };
  } catch (err: unknown) {
    console.warn("Push subscription warning:", err);
    return { ok: false, reason: getFriendlyErrorMessage(err, "We couldn’t enable notifications right now. You can try again from Settings.") };
  }
}

  function arrayBufferToBase64(buffer: ArrayBuffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let index = 0; index < bytes.length; index += 1) {
      binary += String.fromCharCode(bytes[index]);
    }
    return window.btoa(binary);
  }
export async function sendPushTestNotification(userId: string) {
  try {
    if (!userId) return { ok: false, reason: "Your profile is still loading. Please try again in a moment." };
    const result = await invokeNotificationApi<{ delivered: number }>({
      action: "test",
      userId,
      title: "Déloci test notification",
      body: "Push notifications are connected to this device.",
      type: "update",
      url: "/main?tab=profile",
    });
    if (result.delivered === 0) return { ok: false, reason: "This device doesn’t have notifications enabled yet. Turn them on in Settings and try again." };
    return { ok: true, data: { delivered: result.delivered } };
  } catch (err: unknown) {
    return { ok: false, reason: getFriendlyErrorMessage(err, "We couldn’t send a test notification just now. Please try again.") };
  }
}