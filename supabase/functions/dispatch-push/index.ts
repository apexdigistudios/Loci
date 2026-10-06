import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type Session = {
  id: string;
  user_phone: string;
  destination: string;
  expected_arrival_at: string;
  status: string;
  created_at: string;
  user_reminder_mins: number;
  contact_reminder_mins: number;
  last_user_checkin_at: string;
  last_user_reminder_sent_at: string | null;
  session_started_push_sent_at: string | null;
  session_completed_push_sent_at: string | null;
  guardian_alert_sent_at: string | null;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:hello.deloci@gmail.com";
const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

async function getDisplayName(phone: string) {
  const { data } = await supabase
    .from<{ nickname: string | null; full_name: string | null }>("users")
    .select("nickname, full_name")
    .eq("phone", phone)
    .maybeSingle();
  return data?.nickname || data?.full_name || phone;
}

async function getGuardianPhones(session: Session) {
  const { data: recipients } = await supabase
    .from<{ recipient_phone: string }>("session_recipients")
    .select("recipient_phone")
    .eq("session_id", session.id);
  return [...new Set((recipients || []).map((row) => row.recipient_phone))];
}

async function sendPush(phone: string, payload: Record<string, unknown>) {
  const { data: subscriptions } = await supabase
    .from<{ id: string; endpoint: string; p256dh: string; auth: string }>("user_push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_phone", phone);
  let delivered = false;

  for (const subscription of subscriptions || []) {
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        JSON.stringify(payload)
      );
      delivered = true;
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from("user_push_subscriptions").delete().eq("id", subscription.id);
      } else {
        console.error(`Push delivery failed for ${phone}:`, error);
      }
    }
  }
  return delivered;
}

async function sendToGuardians(session: Session, title: string, body: string) {
  const guardianPhones = await getGuardianPhones(session);
  if (guardianPhones.length === 0) return false;

  const deliveries = await Promise.all(guardianPhones.map((phone) => sendPush(phone, {
    title,
    body,
    sessionId: session.id,
    url: `https://deloci.online/main?sharedSessionId=${encodeURIComponent(session.id)}`,
  })));
  return deliveries.every(Boolean);
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (request.headers.get("authorization") !== `Bearer ${serviceRoleKey}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: sessions, error } = await supabase
    .from<Session>("checkin_sessions")
    .select("*")
    .in("status", ["active", "completed"])
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const now = Date.now();
  for (const row of sessions || []) {
    const session = row as Session;
    const ownerName = await getDisplayName(session.user_phone);

    if (session.status === "active" && !session.session_started_push_sent_at) {
      const sent = await sendToGuardians(session, "Session started", `${ownerName} started a route to ${session.destination}.`);
      if (sent) {
        await supabase.from("checkin_sessions")
          .update({ session_started_push_sent_at: new Date().toISOString() })
          .eq("id", session.id)
          .is("session_started_push_sent_at", null);
      }
    }

    const checkinTime = new Date(session.last_user_checkin_at || session.created_at).getTime();
    const reminderDue = session.status === "active" &&
      now >= checkinTime + Math.max(1, session.user_reminder_mins || 15) * 60000 &&
      (!session.last_user_reminder_sent_at || new Date(session.last_user_reminder_sent_at).getTime() < checkinTime);
    if (reminderDue) {
      const sent = await sendPush(session.user_phone, {
        title: "Time to confirm you’re safe!",
        body: "Open Déloci and tap Confirm I’m Safe.",
        sessionId: session.id,
        url: "https://deloci.online/main",
      });
      if (sent) {
        const { error: reminderError } = await supabase.from("checkin_sessions")
          .update({ last_user_reminder_sent_at: new Date().toISOString() })
          .eq("id", session.id)
          .eq("status", "active");
        if (reminderError) console.error(`Could not mark user reminder sent for ${session.id}:`, reminderError);
      }
    }

    const guardianDueAt = new Date(session.expected_arrival_at).getTime() +
      Math.max(1, session.contact_reminder_mins || 30) * 60000;
    if (
      session.status === "active" &&
      !session.guardian_alert_sent_at &&
      now >= guardianDueAt &&
      checkinTime <= new Date(session.expected_arrival_at).getTime()
    ) {
      const sent = await sendToGuardians(session, "Safety alert", `ALERT: ${ownerName} has not checked in after their expected arrival at ${session.destination}.`);
      if (sent) {
        await supabase.from("checkin_sessions")
          .update({ guardian_alert_sent_at: new Date().toISOString() })
          .eq("id", session.id)
          .eq("status", "active")
          .is("guardian_alert_sent_at", null);
      }
    }

    if (session.status === "completed" && !session.session_completed_push_sent_at) {
      const sent = await sendToGuardians(session, "Arrived safely", `${ownerName} arrived safely at ${session.destination}.`);
      if (sent) {
        await supabase.from("checkin_sessions")
          .update({ session_completed_push_sent_at: new Date().toISOString() })
          .eq("id", session.id)
          .is("session_completed_push_sent_at", null);
      }
    }
  }

  return Response.json({ processed: sessions?.length || 0 });
});