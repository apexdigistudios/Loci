import { supabase } from "@/lib/supabase";

export async function invokeNotificationApi<T>(body: Record<string, unknown>): Promise<T> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error("Could not read your sign-in session.", { cause: sessionError });

  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("Your sign-in has expired. Please sign in again to continue.");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) throw new Error("The notification service is not configured.");

  const response = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const responseText = await response.text();
  let result: unknown;
  try {
    result = responseText ? JSON.parse(responseText) : null;
  } catch {
    result = { error: responseText || "The notification service returned an invalid response." };
  }

  if (!response.ok) {
    const message = result && typeof result === "object" && "error" in result && typeof result.error === "string"
      ? result.error
      : `Notification request failed (${response.status}).`;
    console.warn("Notification function request failed:", {
      status: response.status,
      statusText: response.statusText,
      body: result,
    });
    throw new Error(message, { cause: { status: response.status, body: result } });
  }

  if (result === null) throw new Error("The notification service returned an empty response.");
  return result as T;
}