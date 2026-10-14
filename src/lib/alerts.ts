import { normalizePhone } from "@/lib/utils";

let alertAudioContext: AudioContext | null = null;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioContextConstructor = window.AudioContext;
  if (!AudioContextConstructor) return null;
  alertAudioContext ??= new AudioContextConstructor();
  return alertAudioContext;
}

export async function prepareAlertFeedback() {
  const context = getAudioContext();
  if (context?.state === "suspended") {
    try {
      await context.resume();
    } catch (error) {
      console.warn("Could not prepare alert audio:", error);
    }
  }
}

export function triggerAlertFeedback() {
  if (typeof window === "undefined") return;

  if ("vibrate" in navigator) {
    navigator.vibrate([300, 100, 300, 100, 500]);
  }

  const context = getAudioContext();
  if (!context) return;

  try {
    if (context.state === "suspended") void context.resume();
    const now = context.currentTime;
    const notes = [880, 660, 880];

    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const startAt = now + index * 0.16;
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(frequency, startAt);
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.22, startAt + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.13);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + 0.14);
    });
  } catch (error) {
    console.warn("Could not play alert sound:", error);
  }
}

function normalizeAlertTarget(target: string): string | null {
  const value = target.trim();
  if (!value) return null;
  if (UUID_PATTERN.test(value)) return value;
  if (EMAIL_PATTERN.test(value)) return value.toLowerCase();

  const phone = normalizePhone(value);
  return /^\+\d{8,15}$/.test(phone) ? phone : null;
}

export function sendPushAlert(
  userIds: string | string[],
  title: string,
  message: string,
  url: string = "/"
) {
  if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
    const options: NotificationOptions = {
      body: message,
      icon: "/icon-192x192.png",
      tag: "deloci-local-alert",
      data: { url },
    };

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.ready
        .then((registration) => registration.showNotification(title, options))
        .catch((error) => {
          console.warn("Could not show service worker notification:", error);
          try {
            if (Notification.permission === "granted") new Notification(title, options);
          } catch (fallbackError) {
            console.warn("Could not show local alert notification:", fallbackError);
          }
        });
    } else {
      try {
        new Notification(title, options);
      } catch (error) {
        console.warn("Could not show local alert notification:", error);
      }
    }
  }

  if (!userIds) return;
  const rawTargets = Array.isArray(userIds) ? userIds : [userIds];
  const targetIds = Array.from(new Set(rawTargets
    .filter((target): target is string => typeof target === "string")
    .map(normalizeAlertTarget)
    .filter((target): target is string => target !== null)));
  if (targetIds.length === 0) return;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";
  if (supabaseUrl === "https://placeholder.supabase.co" || anonKey === "placeholder-key") return;

  void fetch(`${supabaseUrl}/functions/v1/send-push`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({
      action: "send",
      userIds: targetIds,
      title,
      body: message,
      url,
      tag: "deloci-safety-alert",
    }),
  })
    .then((response) => {
      if (!response.ok) {
        void response.text().catch(() => "").then((body) => {
          console.error("Push alert dispatch failed:", response.status, body);
        });
      }
    })
    .catch((error) => console.error("Failed to dispatch push alert:", error));
}