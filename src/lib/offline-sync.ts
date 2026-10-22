import { db, type OfflineContact, type OfflineQueueItem, type OfflineSession } from "@/lib/db";
import { invokeNotificationApi } from "@/lib/notification-api";
import { supabase } from "@/lib/supabase";

export type OfflineActionType = OfflineQueueItem["action_type"];

export async function cacheActiveSessionLocally(session: OfflineSession) {
  try {
    await db.checkin_sessions.put(session);
  } catch (error) {
    console.error("Failed to cache session locally:", error);
  }
}

export async function getCachedActiveSession(userPhone?: string): Promise<OfflineSession | null> {
  try {
    const sessions = await db.checkin_sessions.toArray();
    return sessions.find((session) =>
      (!userPhone || session.user_phone === userPhone || session.scope_phone === userPhone)
      && (session.status === "active" || session.status === "escalated")
    ) || null;
  } catch (error) {
    console.error("Failed to read local session cache:", error);
    return null;
  }
}

export async function cacheContactsLocally(contacts: OfflineContact[]) {
  try {
    await db.trusted_contacts.bulkPut(contacts);
  } catch (error) {
    console.error("Failed to cache contacts locally:", error);
  }
}

export async function queueOfflineAction(
  action_type: OfflineActionType,
  payload: Record<string, unknown>,
  entity_id?: string
) {
  try {
    if (action_type === "update_location" && entity_id) {
      const pending = await db.offline_queue
        .where("action_type")
        .equals(action_type)
        .filter((item) => item.entity_id === entity_id)
        .first();
      if (pending?.id !== undefined) {
        await db.offline_queue.update(pending.id, {
          payload,
          created_at: new Date().toISOString(),
          attempts: 0,
          last_error: undefined,
        });
      } else {
        await db.offline_queue.add({ action_type, entity_id, payload, created_at: new Date().toISOString(), attempts: 0 });
      }
    } else {
      await db.offline_queue.add({ action_type, entity_id, payload, created_at: new Date().toISOString(), attempts: 0 });
    }

    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        const syncRegistration = registration as ServiceWorkerRegistration & {
          sync?: { register: (tag: string) => Promise<void> };
        };
        await syncRegistration.sync?.register("deloci-offline-sync");
      } catch (error) {
        console.info("Background Sync unavailable; the queue will flush when the app is online:", error);
      }
    }
    if (typeof navigator !== "undefined" && navigator.onLine) void flushOfflineQueue();
  } catch (error) {
    console.error("Failed to add action to offline queue:", error);
    throw error;
  }
}

async function flushItem(item: OfflineQueueItem) {
  const payload = item.payload;
  const localSessionId = typeof payload.sessionId === "string" ? payload.sessionId : item.entity_id;
  const cachedSession = localSessionId ? await db.checkin_sessions.get(localSessionId) : undefined;
  const sessionId = typeof payload.serverSessionId === "string"
    ? payload.serverSessionId
    : cachedSession?.server_id || (localSessionId?.startsWith("local-") ? undefined : localSessionId);

  switch (item.action_type) {
    case "start_session": {
      const session = payload.session as Record<string, unknown> | undefined;
      if (!session) throw new Error("Queued session is missing its session data.");
      let serverSessionId = typeof payload.serverSessionId === "string" ? payload.serverSessionId : undefined;
      if (!serverSessionId) {
        if (localSessionId) {
          const { data: existing, error: lookupError } = await supabase
            .from("checkin_sessions")
            .select("id")
            .eq("client_mutation_id", localSessionId)
            .maybeSingle();
          if (lookupError) throw lookupError;
          serverSessionId = existing?.id;
        }
      }
      if (!serverSessionId) {
        const insertRecord = { ...session };
        delete insertRecord.id;
        delete insertRecord.scope_phone;
        delete insertRecord.server_id;
        insertRecord.client_mutation_id = localSessionId || session.id;
        const { data: inserted, error } = await supabase
          .from("checkin_sessions")
          .insert(insertRecord)
          .select("id")
          .single();
        if (error) throw new Error(`Create queued session: ${error.message}`);
        if (!inserted) throw new Error("Create queued session: Supabase returned no data.");
        serverSessionId = inserted.id;
        payload.serverSessionId = serverSessionId;
        await db.offline_queue.update(item.id!, { payload });
      }

      const recipients = Array.isArray(payload.recipients)
        ? payload.recipients as Array<{ contact_phone: string; recipient_phone: string }>
        : [];
      if (recipients.length > 0) {
        const { data: savedRecipients, error: recipientReadError } = await supabase
          .from("session_recipients")
          .select("contact_phone")
          .eq("session_id", serverSessionId);
        if (recipientReadError) throw recipientReadError;
        const savedPhones = new Set((savedRecipients || []).map((recipient) => recipient.contact_phone));
        const missingRecipients = recipients
          .filter((recipient) => !savedPhones.has(recipient.contact_phone))
          .map((recipient) => ({ ...recipient, session_id: serverSessionId }));
        if (missingRecipients.length > 0) {
          const { error } = await supabase.from("session_recipients").insert(missingRecipients);
          if (error) throw error;
        }
      }

      if (localSessionId) {
        await db.checkin_sessions.update(localSessionId, { server_id: serverSessionId });
      }
      break;
    }
    case "safe_checkin": {
      if (!sessionId) throw new Error("Queued check-in is waiting for its session to sync.");
      const { error } = await supabase
        .from("checkin_sessions")
        .update({ last_user_checkin_at: payload.timestamp || new Date().toISOString() })
        .eq("id", sessionId);
      if (error) throw error;
      break;
    }
    case "complete_session": {
      if (!sessionId) throw new Error("Queued completion is waiting for its session to sync.");
      const { error } = await supabase.from("checkin_sessions").update({ status: "completed" }).eq("id", sessionId);
      if (error) throw error;
      if (localSessionId) await db.checkin_sessions.delete(localSessionId);
      break;
    }
    case "escalate_session": {
      if (!sessionId) throw new Error("Queued SOS is waiting for its session to sync.");
      const { error } = await supabase.from("checkin_sessions").update({
        status: "escalated",
        notes: payload.notes,
        current_lat: payload.current_lat ?? null,
        current_lng: payload.current_lng ?? null,
        metadata: payload.metadata || {},
      }).eq("id", sessionId);
      if (error) throw error;
      break;
    }
    case "send_alert": {
      await invokeNotificationApi({
        action: "send",
        userIds: payload.userIds,
        title: payload.title,
        body: payload.message,
        type: payload.type || "update",
        url: payload.url || "/main?tab=notifications",
        tag: payload.tag || `deloci-${String(payload.type || "update")}`,
        metadata: {
          ...(payload.metadata as Record<string, unknown> || {}),
          ...(sessionId ? { sessionId } : {}),
        },
      });
      break;
    }
    case "update_location": {
      const coordinates = payload.coordinates as { latitude?: number; longitude?: number } | undefined;
      if (!sessionId || !coordinates || !Number.isFinite(coordinates.latitude) || !Number.isFinite(coordinates.longitude)) {
        throw new Error("Queued location update is incomplete.");
      }
      const { error } = await supabase.from("checkin_sessions").update({
        current_lat: coordinates.latitude,
        current_lng: coordinates.longitude,
        metadata: payload.metadata || {
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          updated_at: payload.timestamp || new Date().toISOString(),
        },
      }).eq("id", sessionId);
      if (error) throw error;
      break;
    }
    case "add_contact": {
      const contact = payload.contact as Record<string, unknown> | undefined;
      if (!contact) throw new Error("Queued contact is missing its contact data.");
      let serverContactId = typeof payload.serverContactId === "string" ? payload.serverContactId : undefined;
      if (!serverContactId) {
        const insertRecord = { ...contact };
        delete insertRecord.id;
        delete insertRecord.server_id;
        const { data: inserted, error } = await supabase
          .from("trusted_contacts")
          .insert(insertRecord)
          .select("id")
          .single();
        if (error) throw new Error(`Create queued contact: ${error.message}`);
        if (!inserted) throw new Error("Create queued contact: Supabase returned no data.");
        serverContactId = inserted.id;
        payload.serverContactId = serverContactId;
        await db.offline_queue.update(item.id!, { payload });
      }
      await db.trusted_contacts.update(String(contact.id), { server_id: serverContactId });
      break;
    }
    case "delete_contact": {
      const localContactId = String(payload.id || "");
      const contact = await db.trusted_contacts.get(localContactId);
      const serverContactId = contact?.server_id || (localContactId.startsWith("local-contact-") ? null : localContactId);
      if (!serverContactId) break;
      const { error } = await supabase.from("trusted_contacts").delete().eq("id", serverContactId);
      if (error) throw error;
      await db.trusted_contacts.delete(localContactId);
      break;
    }
    case "notification_read": {
      await invokeNotificationApi({ action: "mark_read", id: payload.id, isRead: payload.is_read });
      break;
    }
    case "notification_delete": {
      await invokeNotificationApi({ action: "delete", id: payload.id });
      break;
    }
    case "notification_clear": {
      await invokeNotificationApi({ action: "clear" });
      break;
    }
  }
}

let flushPromise: Promise<void> | null = null;

export function flushOfflineQueue(): Promise<void> {
  if (flushPromise) return flushPromise;
  flushPromise = (async () => {
    if (typeof window === "undefined" || !navigator.onLine) return;

    const queuedItems = await db.offline_queue.orderBy("id").toArray();
    for (const item of queuedItems) {
      try {
        await flushItem(item);
        if (item.id !== undefined) await db.offline_queue.delete(item.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn("Offline action remains queued for retry:", item.action_type, message);
        if (item.id !== undefined) {
          await db.offline_queue.update(item.id, {
            attempts: (item.attempts || 0) + 1,
            last_error: message,
          });
        }
      }
      if (!navigator.onLine) break;
    }
  })().finally(() => {
    flushPromise = null;
  });
  return flushPromise;
}
