import { supabase } from "@/lib/supabase";
import { getFriendlyErrorMessage } from "@/lib/friendly-errors";

const SESSION_STORAGE_KEY = "loci_notification_session";

export interface PublicProfile {
  id: string;
  phone: string;
  full_name: string | null;
  nickname: string | null;
  avatar_url: string | null;
  hasPin?: boolean;
}

interface AuthSessionState {
  sessionToken: string;
  expiresAt: string;
}

interface AuthResponse {
  success?: boolean;
  sessionToken?: string;
  expiresAt?: string;
  userId?: string;
  user?: PublicProfile;
  hasPin?: boolean;
  referrer?: { full_name: string | null; nickname: string | null } | null;
  error?: string;
}

async function invokeAuthApi(body: Record<string, unknown>): Promise<AuthResponse> {
  const { data, error } = await supabase.functions.invoke<AuthResponse>("deloci-auth", { body });

  if (error) {
    const context = (error as { context?: Response }).context;
    if (context instanceof Response) {
      try {
        const payload = (await context.clone().json()) as { error?: string };
        if (payload.error) throw new Error(payload.error);
      } catch {
        // fall through to the friendly error below
      }
    }
    throw new Error(getFriendlyErrorMessage(error, "We couldn’t complete that request. Please try again."));
  }

  if (!data || typeof data !== "object") {
    throw new Error("We couldn’t complete that request. Please try again.");
  }

  return data;
}

export async function createAccount(input: {
  phone: string;
  fullName: string;
  nickname: string;
  pin: string;
  avatarUrl?: string;
}): Promise<PublicProfile> {
  const response = await invokeAuthApi({ action: "signup", ...input });
  if (!response.success || !response.sessionToken || !response.user?.id) {
    throw new Error(response.error || "We couldn’t create your account just now. Please try again.");
  }

  const sessionState: AuthSessionState = {
    sessionToken: response.sessionToken,
    expiresAt: response.expiresAt || new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
  };
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionState));
  return response.user;
}

export async function createNotificationSession(
  userId: string,
  phone: string,
  pin: string
): Promise<PublicProfile> {
  const response = await invokeAuthApi({ action: "login", userId, phone, pin });
  if (!response.success || !response.sessionToken || !response.user?.id) {
    throw new Error(response.error || "We couldn’t finish signing you in. Please try again.");
  }

  const sessionState: AuthSessionState = {
    sessionToken: response.sessionToken,
    expiresAt: response.expiresAt || new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
  };
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionState));
  return response.user;
}

export function getNotificationSessionToken(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const session = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || "null") as AuthSessionState | null;
    if (!session?.sessionToken || !session.expiresAt || Date.parse(session.expiresAt) <= Date.now()) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return session.sessionToken;
  } catch {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

export function clearNotificationSession(): void {
  if (typeof window !== "undefined") localStorage.removeItem(SESSION_STORAGE_KEY);
}

export async function getNotificationPinStatus(phone: string): Promise<boolean> {
  const response = await invokeAuthApi({ action: "check_pin_status", phone });
  return response.hasPin === true;
}

export async function lookupProfileByPhone(phone: string): Promise<PublicProfile | null> {
  const response = await invokeAuthApi({ action: "lookup_user", phone });
  return response.user || null;
}

export async function setAccountPin(phone: string, pin: string): Promise<void> {
  const response = await invokeAuthApi({ action: "set_pin", phone, pin });
  if (!response.success || !response.sessionToken) {
    throw new Error(response.error || "We couldn’t save your PIN just now. Please try again.");
  }

  const sessionState: AuthSessionState = {
    sessionToken: response.sessionToken,
    expiresAt: response.expiresAt || new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
  };
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionState));
}

export async function invokeNotificationApi<T>(body: Record<string, unknown>): Promise<T> {
  const token = getNotificationSessionToken();
  if (!token) throw new Error("Your sign-in has expired. Please sign in again to continue.");

  const { data, error } = await supabase.functions.invoke<T>("send-push", {
    body,
    headers: { "x-loci-session": token },
  });

  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 401 && typeof window !== "undefined") {
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
    // completed locally below
  } finally {
    clearNotificationSession();
  }
}

export async function lookupReferrer(code: string): Promise<{ full_name: string | null; nickname: string | null } | null> {
  const response = await invokeAuthApi({ action: "lookup_referrer", code });
  return response.referrer || null;
}
