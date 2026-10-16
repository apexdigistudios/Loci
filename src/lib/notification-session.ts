import { supabase } from "@/lib/supabase";

const SESSION_STORAGE_KEY = "loci_notification_session";

interface SessionResponse {
  token: string;
  expiresAt: string;
}

export async function createNotificationSession(
  userId: string,
  phone: string,
  pin: string
): Promise<void> {
  const { data, error } = await supabase.functions.invoke<SessionResponse>("send-push", {
    body: { action: "create_session", userId, phone, pin },
  });

  if (error) {
    const response = (error as typeof error & { context?: Response }).context;
    if (response instanceof Response) {
      let message = "";
      try {
        const payload = await response.clone().json() as { error?: string };
        message = payload.error || "";
      } catch {}
      if (message) throw new Error(message);
    }
    throw new Error(error.message);
  }
  if (!data?.token || !data.expiresAt) throw new Error("Notification session was not issued.");

  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
}

export function getNotificationSessionToken(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const session = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || "null") as SessionResponse | null;
    if (!session?.token || !session.expiresAt || Date.parse(session.expiresAt) <= Date.now()) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return session.token;
  } catch {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

export function clearNotificationSession(): void {
  if (typeof window !== "undefined") localStorage.removeItem(SESSION_STORAGE_KEY);
}

export async function invokeNotificationApi<T>(body: Record<string, unknown>): Promise<T> {
  const token = getNotificationSessionToken();
  if (!token) throw new Error("Your notification session expired. Sign in again.");

  const { data, error } = await supabase.functions.invoke<T>("send-push", {
    body,
    headers: { "x-loci-session": token },
  });

  if (error) {
    const status = (error as typeof error & { context?: { status?: number } }).context?.status;
    if (status === 401) {
      clearNotificationSession();
      window.dispatchEvent(new Event("loci:notification-session-expired"));
    }
    throw new Error(error.message);
  }
  if (data == null) throw new Error("The notification service returned no response.");
  return data;
}

export async function endNotificationSession(): Promise<void> {
  try {
    await invokeNotificationApi({ action: "end_session" });
  } catch {
    // The token is cleared locally even when the server cannot be reached.
  } finally {
    clearNotificationSession();
  }
}

export async function getNotificationPinStatus(phone: string): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke<{ hasPin: boolean }>("send-push", {
    body: { action: "check_pin_status", phone },
  });
  if (error) throw new Error(error.message);
  return data?.hasPin === true;
}