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
    const cleanedPhones = Array.from(
      new Set(receiverPhones.map((phone) => cleanPhone(phone)).filter(Boolean))
    );

    if (cleanedPhones.length === 0) {
      return { success: false, deliveredCount: 0, error: "No valid phone numbers found." };
    }

    const { data: users, error: userError } = await supabase
      .from("users")
      .select("id, phone")
      .in("phone", cleanedPhones);

    if (userError) {
      console.error("[ReceiverPush] Error querying recipient users:", userError);
      return { success: false, deliveredCount: 0, error: userError.message };
    }

    if (!users || users.length === 0) {
      return { success: false, deliveredCount: 0, error: "No registered app users matched these phones." };
    }

    const targetUserIds = users.map((u) => u.id);

    const { data, error: fnError } = await supabase.functions.invoke("send-push-notification", {
      body: {
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

    return {
      success: true,
      deliveredCount: data?.delivered ?? targetUserIds.length,
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