import { supabase } from "@/lib/supabase";
import { getFriendlyErrorMessage } from "@/lib/friendly-errors";

const SESSION_STORAGE_KEY = "loci_notification_session";

interface SessionResponse {
  token: string;
  expiresAt: string;
}

export async function createNotificationSession(
  userId: string,
  phone: string,
  pin: string
): Promise<PublicProfile> {
  const { data, error } = await supabase.functions.invoke<SessionResponse & { user: PublicProfile }>("send-push", {
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
      if (message) throw new Error(getFriendlyErrorMessage(message));
    }
    throw new Error(getFriendlyErrorMessage(error));
  }
  if (!data?.token || !data.expiresAt || !data.user?.id) {
    throw new Error("We couldn’t finish signing you in. Please try again.");
  }

  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
  return data.user;
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
  if (!token) throw new Error("Your sign-in has expired. Please sign in again to continue.");

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
    throw new Error(getFriendlyErrorMessage(error));
  }
  if (data == null) throw new Error("We couldn’t complete that request. Please try again.");
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
  if (error) throw new Error(getFriendlyErrorMessage(error, "We couldn’t check your account just now. Please try again."));
  return data?.hasPin === true;
}

export interface PublicProfile {
  id: string;
  phone: string;
  full_name: string | null;
  nickname: string | null;
  avatar_url: string | null;
  hasPin?: boolean;
}

export async function lookupProfileByPhone(phone: string): Promise<PublicProfile | null> {
  const { data, error } = await supabase.functions.invoke<{ user: PublicProfile | null }>("send-push", {
    body: { action: "lookup_user", phone },
  });
  if (error) throw new Error(getFriendlyErrorMessage(error, "We couldn’t check that number just now. Please try again."));
  return data?.user || null;
}

export async function setAccountPin(phone: string, pin: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke<SessionResponse>("send-push", {
    body: { action: "set_pin", phone, pin },
  });
  if (error) {
    const response = (error as typeof error & { context?: Response }).context;
    if (response instanceof Response) {
      try {
        const payload = await response.clone().json() as { error?: string };
        if (payload.error) throw new Error(getFriendlyErrorMessage(payload.error));
      } catch (responseError) {
        if (responseError instanceof Error && responseError.message !== "Unexpected end of JSON input") throw responseError;
      }
    }
    throw new Error(getFriendlyErrorMessage(error, "We couldn’t save your PIN just now. Please try again."));
  }
  if (!data?.token || !data.expiresAt) throw new Error("We couldn’t finish signing you in. Please try again.");
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
}

export async function createAccount(input: {
  phone: string;
  fullName: string;
  nickname: string;
  pin: string;
  avatarUrl?: string;
}): Promise<PublicProfile> {
  const { data, error } = await supabase.functions.invoke<{ user: PublicProfile } & SessionResponse>("send-push", {
    body: { action: "signup", ...input },
  });
  if (error) {
    const response = (error as typeof error & { context?: Response }).context;
    if (response instanceof Response) {
      try {
        const payload = await response.clone().json() as { error?: string };
        if (payload.error) throw new Error(getFriendlyErrorMessage(payload.error));
      } catch (responseError) {
        if (responseError instanceof Error && responseError.message !== "Unexpected end of JSON input") throw responseError;
      }
    }
    throw new Error(getFriendlyErrorMessage(error, "We couldn’t create your account just now. Please try again."));
  }
  if (!data?.user?.id || !data.token || !data.expiresAt) {
    throw new Error("Your account may have been created, but we couldn’t finish signing you in. Please sign in.");
  }
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token: data.token, expiresAt: data.expiresAt }));
  return data.user;
}

export async function lookupReferrer(code: string): Promise<{ full_name: string | null; nickname: string | null } | null> {
  const { data, error } = await supabase.functions.invoke<{
    referrer: { full_name: string | null; nickname: string | null } | null;
  }>("send-push", { body: { action: "lookup_referrer", code } });
  if (error) throw new Error(getFriendlyErrorMessage(error, "We couldn’t load this invitation just now."));
  return data?.referrer || null;
}