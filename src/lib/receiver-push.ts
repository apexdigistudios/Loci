import { supabase } from "@/lib/supabase";
import { cleanPhone } from "@/lib/utils";

export interface ReceiverPushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export interface SendReceiverPushResult {
  success: boolean;
  deliveredCount: number;
  error?: string;
}

export interface NotifyReceiverContactsParams {
  contactPhones: string[];
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Sends a web push notification to a list of guardian/receiver phone numbers.
 */
export async function sendPushToReceivers(
  receiverPhones: string[],
  payload: ReceiverPushPayload
): Promise<SendReceiverPushResult> {
  if (!receiverPhones || receiverPhones.length === 0) {
    return { success: false, deliveredCount: 0, error: "No target phones provided." };
  }

  try {
    // 1. Prepare search phones (both cleaned and raw inputs to prevent formatting mismatches)
    const cleanedPhones = receiverPhones.map((phone) => cleanPhone(phone)).filter(Boolean);
    const rawPhones = receiverPhones.map((phone) => phone.trim()).filter(Boolean);
    const searchPhones = Array.from(new Set([...cleanedPhones, ...rawPhones]));

    if (searchPhones.length === 0) {
      return { success: false, deliveredCount: 0, error: "No valid phone numbers found." };
    }

    console.log("[ReceiverPush] Searching DB for target phones:", searchPhones);

    // 2. Query matching users
    const { data: users, error: userError } = await supabase
      .from("users")
      .select("id, phone")
      .in("phone", searchPhones);

    if (userError) {
      console.error("[ReceiverPush] Error querying recipient users:", userError);
      return { success: false, deliveredCount: 0, error: userError.message };
    }

    console.log("[ReceiverPush] Matched recipient users from DB:", users);

    if (!users || users.length === 0) {
      console.warn("[ReceiverPush] 0 registered users matched these phone numbers.");
      return { success: false, deliveredCount: 0, error: "No registered app users matched these phones." };
    }

    const targetUserIds = users.map((u) => u.id);

    console.log("[ReceiverPush] Invoking 'send-push' Edge Function for userIds:", targetUserIds);

    // 3. Invoke 'send-push' edge function
    const { data, error: fnError } = await supabase.functions.invoke("send-push", {
      body: {
        action: "send",
        userIds: targetUserIds,
        title: payload.title,
        body: payload.body,
        url: payload.url || "/?tab=contacts",
        tag: payload.tag || "loci-receiver-alert",
      },
    });

    if (fnError) {
      console.error("[ReceiverPush] Edge Function error:", fnError);
      return { success: false, deliveredCount: 0, error: fnError.message };
    }

    console.log("[ReceiverPush] Edge Function execution result:", data);

    return {
      success: true,
      deliveredCount: data?.delivered ?? data?.count ?? targetUserIds.length,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error occurred";
    console.error("[ReceiverPush] Unexpected failure:", err);
    return { success: false, deliveredCount: 0, error: message };
  }
}

/**
 * Wrapper for notifyReceiverContacts used by lib/session-notifications.ts
 */
export async function notifyReceiverContacts({
  contactPhones,
  title,
  body,
  url,
  tag,
}: NotifyReceiverContactsParams): Promise<SendReceiverPushResult> {
  return sendPushToReceivers(contactPhones, { title, body, url, tag });
}