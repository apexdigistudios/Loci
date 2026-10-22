import { normalizePhone } from "@/lib/utils";
import { invokeNotificationApi } from "@/lib/notification-api";
import { getFriendlyErrorMessage } from "@/lib/friendly-errors";
import { supabase } from "@/lib/supabase";

export type AlertType = "session_start" | "checkin" | "emergency" | "session_end" | "update" | "guardian_alert";

export interface AlertRequest {
  userIds: string | string[];
  title: string;
  message: string;
  type?: AlertType;
  url?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  playFeedback?: boolean;
  showLocal?: boolean;
}

interface DispatchResult {
  localShown: boolean;
  delivered: number;
  notificationCount: number;
  error?: string;
}

let alertAudioContext: AudioContext | null = null;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const Context = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return null;
  alertAudioContext ??= new Context();
  return alertAudioContext;
}

export async function prepareAlertFeedback() {
  try {
    const context = getAudioContext();
    if (context?.state === "suspended") {
      await context.resume();
    }
  } catch (error) {
    console.warn("Could not prepare alert audio:", error);
  }
}

export function triggerAlertFeedback(type: AlertType = "emergency") {
  if (typeof window === "undefined") return;

  const vibrationPattern = type === "checkin"
    ? [100, 60, 100]
    : type === "emergency" || type === "guardian_alert"
    ? [400, 100, 400, 100, 800]
    : [180, 80, 180];
  try {
    if (typeof navigator.vibrate === "function") navigator.vibrate(vibrationPattern);

    const context = getAudioContext();
    if (!context) return;
    void context.resume().then(() => {
      const notes = type === "emergency" || type === "guardian_alert"
        ? [880, 440, 880, 440]
        : type === "checkin"
        ? [660, 880]
        : [740, 980];
      const now = context.currentTime;
      notes.forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const startAt = now + index * 0.2;
        oscillator.type = type === "emergency" || type === "guardian_alert" ? "sawtooth" : "triangle";
        oscillator.frequency.setValueAtTime(frequency, startAt);
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(0.18, startAt + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.16);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(startAt);
        oscillator.stop(startAt + 0.17);
      });
    }).catch((error) => console.warn("Could not play alert sound:", error));
  } catch (error) {
    console.warn("Could not trigger device feedback:", error);
  }
}

function normalizeTarget(target: string) {
  const value = target.trim();
  if (UUID_PATTERN.test(value)) return value;
  if (EMAIL_PATTERN.test(value)) return value.toLowerCase();
  const phone = normalizePhone(value);
  return /^\+\d{8,15}$/.test(phone) ? phone : null;
}

async function showLocalNotification(title: string, message: string, url: string, type: AlertType) {
  if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return false;
  const options: NotificationOptions = {
    body: message,
    icon: "/icon-192x192.png",
    badge: "/badge-72x72.png",
    tag: `deloci-${type}`,
    data: { url },
  };

  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, options);
    } else {
      new Notification(title, options);
    }
    return true;
  } catch (error) {
    console.warn("Could not show local notification:", error);
    return false;
  }
}

export async function dispatchAlert(request: AlertRequest): Promise<AlertDispatchResult> {
  const type = request.type || "update";
  const url = request.url || "/main?tab=notifications";
  const targets = Array.from(new Set(
    (Array.isArray(request.userIds) ? request.userIds : [request.userIds])
      .filter((target): target is string => typeof target === "string")
      .map(normalizeTarget)
      .filter((target): target is string => target !== null)
  ));

  if (request.playFeedback !== false) triggerAlertFeedback(type);
  const localPromise = request.showLocal === false
    ? Promise.resolve(false)
    : showLocalNotification(request.title, request.message, url, type);

  // Persist check-in and session alerts to Supabase notifications table for UUID users
  const dbPersistPromises = targets
    .filter((target) => UUID_PATTERN.test(target))
    .map(async (uuidTarget) => {
      try {
        await supabase.from("notifications").insert({
          user_id: uuidTarget,
          title: request.title,
          message: request.message,
          type,
          url,
          session_id: request.sessionId || null,
          metadata: request.metadata || null,
          read: false,
        });
      } catch (err) {
        console.warn("Failed to persist alert to database notifications table:", err);
      }
    });

  const pushPromise = targets.length > 0
    ? invokeNotificationApi<{ delivered: number; notificationCount: number }>({
        action: "send",
        userIds: targets,
        title: request.title,
        body: request.message,
        type,
        url,
        tag: `deloci-${type}`,
        metadata: { ...(request.metadata || {}), ...(request.sessionId ? { sessionId: request.sessionId } : {}) },
      })
    : Promise.resolve({ delivered: 0, notificationCount: 0 });

  const [localResult, , pushResult] = await Promise.allSettled([
    localPromise,
    Promise.all(dbPersistPromises),
    pushPromise,
  ]);
  
  const push = pushResult.status === "fulfilled" ? pushResult.value : null;
  return {
    localShown: localResult.status === "fulfilled" && localResult.value,
    delivered: push?.delivered || 0,
    notificationCount: push?.notificationCount || 0,
    error: pushResult.status === "rejected"
      ? getFriendlyErrorMessage(pushResult.reason, "We couldn’t send that update just now. Please try again.")
      : undefined,
  };
}

export type AlertDispatchResult = DispatchResult;