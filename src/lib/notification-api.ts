import { supabase } from "@/lib/supabase";
import { getFriendlyErrorMessage } from "@/lib/friendly-errors";

export async function invokeNotificationApi<T>(body: Record<string, unknown>): Promise<T> {
  // 1. Get current session token
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (sessionError || !accessToken) {
    throw new Error("Your sign-in has expired. Please sign in again to continue.");
  }

  try {
    // 2. Pass body and explicit headers to invoke
    const { data, error } = await supabase.functions.invoke<T>("send-push", {
      body,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (error) {
      throw error;
    }

    if (data == null) {
      throw new Error("The notification service returned an empty response.");
    }

    return data;
  } catch (error) {
    const friendlyMessage = getFriendlyErrorMessage(
      error,
      "We couldn’t complete that notification request right now. Please try again."
    );

    const context = error && typeof error === "object" && "context" in error
      ? (error as { context?: unknown }).context
      : undefined;

    const status = context instanceof Response ? context.status : undefined;

    console.warn("Notification request failed.", {
      message: friendlyMessage,
      status,
      error,
    });

    throw new Error(friendlyMessage, { cause: error });
  }
}