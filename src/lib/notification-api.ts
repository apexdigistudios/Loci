import { supabase } from "@/lib/supabase";

export async function invokeNotificationApi<T>(body: Record<string, unknown>): Promise<T> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (sessionError || !accessToken) {
    throw new Error("Your sign-in has expired. Please sign in again to continue.");
  }

  const { data, error } = await supabase.functions.invoke<T>("send-push", {
    body,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (error) throw error;
  if (data == null) throw new Error("We couldn’t complete that request. Please try again.");
  return data;
}