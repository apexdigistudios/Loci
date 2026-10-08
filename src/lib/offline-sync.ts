import { db, OfflineSession, OfflineContact } from "@/lib/db";
import { supabase } from "@/lib/supabase";

/** Save active session locally for instant offline rendering */
export async function cacheActiveSessionLocally(session: OfflineSession) {
  try {
    await db.checkin_sessions.put(session);
  } catch (error) {
    console.error("Failed to cache session locally:", error);
  }
}

/** Retrieve cached session when network is down */
export async function getCachedActiveSession(): Promise<OfflineSession | null> {
  try {
    const active = await db.checkin_sessions
      .where("status")
      .equals("active")
      .first();
    return active || null;
  } catch (error) {
    console.error("Failed to read local session cache:", error);
    return null;
  }
}

/** Save contacts locally */
export async function cacheContactsLocally(contacts: OfflineContact[]) {
  try {
    await db.trusted_contacts.bulkPut(contacts);
  } catch (error) {
    console.error("Failed to cache contacts locally:", error);
  }
}

/** Queue actions performed while offline */
export async function queueOfflineAction(
  action_type: "safe_checkin" | "complete_session" | "update_location",
  payload: Record<string, unknown>
) {
  try {
    await db.offline_queue.add({
      action_type,
      payload,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to add action to offline queue:", error);
  }
}

/** Process and clear the offline queue when online */
export async function flushOfflineQueue() {
  if (typeof window === "undefined" || !navigator.onLine) return;

  try {
    const queuedItems = await db.offline_queue.orderBy("id").toArray();
    if (queuedItems.length === 0) return;

    for (const item of queuedItems) {
      const { sessionId, coordinates, timestamp } = item.payload as {
        sessionId?: string;
        coordinates?: { latitude: number; longitude: number };
        timestamp?: string;
      };

      if (!sessionId) continue;

      if (item.action_type === "safe_checkin") {
        await supabase
          .from("checkin_sessions")
          .update({
            last_user_checkin_at: timestamp || new Date().toISOString(),
          })
          .eq("id", sessionId);
      } else if (item.action_type === "complete_session") {
        await supabase
          .from("checkin_sessions")
          .update({
            status: "completed",
            updated_at: timestamp || new Date().toISOString(),
          })
          .eq("id", sessionId);

        await db.checkin_sessions.delete(sessionId);
      } else if (item.action_type === "update_location" && coordinates) {
        await supabase
          .from("checkin_sessions")
          .update({
            current_lat: coordinates.latitude,
            current_lng: coordinates.longitude,
          })
          .eq("id", sessionId);
      }

      if (item.id) {
        await db.offline_queue.delete(item.id);
      }
    }
  } catch (error) {
    console.error("Failed to flush offline queue:", error);
  }
}

/** Auto-flush listener setup for online reconnect */
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    void flushOfflineQueue();
  });
}