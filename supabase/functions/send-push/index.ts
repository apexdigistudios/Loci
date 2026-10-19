import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.3";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?\d[\d\s().-]{6,18}$/;
const NOTIFICATION_TYPES = new Set([
  "session_start",
  "checkin",
  "emergency",
  "session_end",
  "update",
  "guardian_alert",
]);

type RequestBody = Record<string, unknown>;
// deno-lint-ignore no-explicit-any
type AdminClient = any;
type Sender = { id: string; phone: string };
type Recipient = { id: string; phone: string };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return JSON.stringify(error);
}

function parseBody(value: unknown): RequestBody | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RequestBody)
    : null;
}

function bearerToken(request: Request) {
  const header = request.headers.get("Authorization") ?? request.headers.get("authorization");
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

async function publishNotificationChange(admin: AdminClient, userId: string) {
  const channel = admin.channel(`notifications:${userId}`, { config: { private: false } });
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Realtime channel timed out")), 5000);
      channel.subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timeout);
          resolve();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          clearTimeout(timeout);
          reject(new Error(`Realtime channel status: ${status}`));
        }
      });
    });
    await channel.send({ type: "broadcast", event: "changed", payload: { userId } });
  } catch (error) {
    console.warn("Notification realtime update failed:", errorMessage(error));
  } finally {
    await admin.removeChannel(channel);
  }
}

async function resolveRecipients(admin: AdminClient, body: RequestBody, fallbackUserId?: string) {
  let targets = [
    ...(Array.isArray(body.userIds) ? body.userIds : []),
    ...(Array.isArray(body.userIds) ? [] : [body.userId ?? body.user_id].filter(Boolean)),
    ...(Array.isArray(body.phones) ? body.phones : []),
    ...(Array.isArray(body.emails) ? body.emails : []),
    ...(body.phone ? [body.phone] : []),
    ...(body.email ? [body.email] : []),
  ].filter((target): target is string => typeof target === "string")
    .map((target) => target.trim())
    .filter(Boolean);

  if (!targets.length && fallbackUserId) {
    targets = [fallbackUserId];
  }

  if (!targets.length) return { recipients: [] as Recipient[], error: null };

  const ids = new Set<string>();
  const phones = new Set<string>();
  const emails = new Set<string>();
  for (const target of targets) {
    if (UUID_PATTERN.test(target)) ids.add(target);
    else if (EMAIL_PATTERN.test(target)) emails.add(normalizeEmail(target));
    else if (PHONE_PATTERN.test(target)) phones.add(normalizePhone(target));
    else return { recipients: null, error: "Invalid notification recipient" };
  }

  const queries = [];
  if (ids.size) queries.push(admin.from("users").select("id, phone").in("id", Array.from(ids)));
  if (phones.size) queries.push(admin.from("users").select("id, phone").in("phone", Array.from(phones)));
  if (emails.size) queries.push(admin.from("users").select("id, phone").in("email", Array.from(emails)));
  const results = await Promise.all(queries);
  if (results.some((result: { error: unknown }) => result.error)) {
    return { recipients: null, error: "Could not resolve notification recipients" };
  }

  const uniqueRecipients = new Map<string, Recipient>();
  for (const result of results) {
    for (const userItem of (result.data ?? [])) {
      const u = userItem as { id: string; phone: string };
      uniqueRecipients.set(u.id, { id: u.id, phone: u.phone });
    }
  }
  return { recipients: Array.from(uniqueRecipients.values()), error: null };
}

async function sendNotifications(
  admin: AdminClient,
  sender: Sender,
  recipients: Recipient[],
  body: RequestBody,
) {
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") || "";
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "";
  if (!vapidPublicKey || !vapidPrivateKey) return jsonResponse({ error: "Push delivery is not configured" }, 500);
  if (!recipients.length) return jsonResponse({ success: true, delivered: 0, notificationCount: 0 });

  const { data: contacts, error: contactsError } = await admin
    .from("trusted_contacts")
    .select("phone")
    .eq("user_phone", sender.phone);
  if (contactsError) return jsonResponse({ error: "Could not verify recipient permissions" }, 500);

  const allowedPhones = new Set((contacts ?? []).map((contact: { phone: string }) => normalizePhone(contact.phone)));
  if (recipients.some((recipient) => recipient.id !== sender.id && !allowedPhones.has(normalizePhone(recipient.phone)))) {
    return jsonResponse({ error: "Recipient is not in your trusted contacts" }, 403);
  }

  const type = typeof body.type === "string" && NOTIFICATION_TYPES.has(body.type) ? body.type : "update";
  const title = typeof body.title === "string" ? body.title.slice(0, 160) : "Déloci Alert";
  const message = typeof body.body === "string" ? body.body.slice(0, 2000) : "Safety update received.";
  const metadata = {
    ...(body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? body.metadata as Record<string, unknown> : {}),
    url: typeof body.url === "string" ? body.url : "/",
    tag: typeof body.tag === "string" ? body.tag.slice(0, 100) : "deloci-alert",
  };

  const { data: notifications, error: insertError } = await admin.from("notifications").insert(
    recipients.map((recipient) => ({
      user_id: recipient.id,
      sender_id: sender.id,
      title,
      message,
      type,
      metadata,
    }))
  ).select("id, user_id");
  if (insertError) return jsonResponse({ error: `Could not save notification: ${errorMessage(insertError)}` }, 500);

  const { data: subscriptions, error: subscriptionsError } = await admin
    .from("user_push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", recipients.map((recipient) => recipient.id))
    .eq("is_active", true);
  if (subscriptionsError) return jsonResponse({ error: "Could not load device subscriptions" }, 500);

  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT") || "mailto:admin@deloci.app",
    vapidPublicKey,
    vapidPrivateKey,
  );
  const payload = JSON.stringify({ title, body: message, type, url: metadata.url, tag: metadata.tag, metadata });
  const deliveries = await Promise.allSettled((subscriptions ?? []).map(async (subscription: { id: string; endpoint: string; p256dh: string; auth: string }) => {
    try {
      return await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      }, payload, { headers: { Urgency: "high" }, TTL: 60 });
    } catch (error) {
      const statusCode = error && typeof error === "object" && "statusCode" in error
        ? (error as { statusCode?: number }).statusCode
        : undefined;
      if (statusCode === 404 || statusCode === 410) {
        await admin
          .from("user_push_subscriptions")
          .update({ is_active: false })
          .eq("id", subscription.id);
      }
      throw error;
    }
  }));

  await Promise.all(recipients.map((recipient) => publishNotificationChange(admin, recipient.id)));
  return jsonResponse({
    success: true,
    notificationCount: (notifications as unknown[])?.length ?? 0,
    delivered: deliveries.filter((delivery) => delivery.status === "fulfilled").length,
    failures: deliveries.filter((delivery) => delivery.status === "rejected").length,
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { status: 200, headers: CORS_HEADERS });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  let action = "";
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() || "";
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Server configuration error: missing keys" }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const token = bearerToken(request);
    if (!token) return jsonResponse({ error: "Unauthorized: missing token" }, 401);

    const authResult = await admin.auth.getUser(token);
    // deno-lint-ignore no-explicit-any
    const user = authResult.data.user as any;
    const authError = authResult.error;
    if (authError || !user) return jsonResponse({ error: `Unauthorized: ${errorMessage(authError)}` }, 401);

    let body: RequestBody | null;
    try {
      body = parseBody(await request.json());
    } catch {
      body = null;
    }
    if (!body) return jsonResponse({ error: "Invalid request body" }, 400);

    action = typeof body.action === "string" ? body.action : "";
    
    const userMetadata = (user.user_metadata ?? {}) as Record<string, unknown>;
    const metaPhone = typeof userMetadata.phone === "string" ? userMetadata.phone : "";
    const userEmail = typeof user.email === "string" ? user.email : "";

    const senderResult = await admin
      .from("users")
      .select("id, phone")
      .eq("id", user.id)
      .maybeSingle();

    let sender: Sender;
    if (senderResult.error || !senderResult.data) {
      const fallbackPhone = metaPhone || (userEmail ? "+" + userEmail.split("@")[0] : "+0000000000");
      const upsertResult = await admin
        .from("users")
        .upsert({ id: user.id, phone: fallbackPhone }, { onConflict: "id" })
        .select("id, phone")
        .single();

      if (upsertResult.error || !upsertResult.data) {
        return jsonResponse({ error: `Could not provision profile: ${errorMessage(upsertResult.error)}` }, 500);
      }
      sender = upsertResult.data as Sender;
    } else {
      sender = senderResult.data as Sender;
    }

    if (action === "subscribe") {
      const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
      const p256dh = typeof body.p256dh === "string" ? body.p256dh : "";
      const auth = typeof body.auth === "string" ? body.auth : "";
      let parsedEndpoint: URL;
      try {
        parsedEndpoint = new URL(endpoint);
      } catch {
        return jsonResponse({ error: "Invalid push endpoint" }, 400);
      }
      if (parsedEndpoint.protocol !== "https:" || !p256dh || !auth) {
        return jsonResponse({ error: "Invalid push subscription" }, 400);
      }
      const { error } = await admin.from("user_push_subscriptions").upsert({
        user_id: sender.id,
        endpoint: parsedEndpoint.toString(),
        p256dh,
        auth,
        device_info: body.deviceInfo && typeof body.deviceInfo === "object" ? body.deviceInfo : {},
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,endpoint" });
      if (error) return jsonResponse({ error: `Could not save subscription: ${errorMessage(error)}` }, 500);
      return jsonResponse({ success: true });
    }

    if (action === "subscription_count") {
      const { count, error } = await admin.from("user_push_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", sender.id)
        .eq("is_active", true);
      if (error) return jsonResponse({ error: "Could not check subscriptions" }, 500);
      return jsonResponse({ count: count ?? 0 });
    }

    if (action === "unread_count") {
      const { count, error } = await admin.from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", sender.id)
        .eq("is_read", false);
      if (error) return jsonResponse({ error: "Could not load count" }, 500);
      return jsonResponse({ count: count ?? 0 });
    }

    if (action === "list") {
      const { data, error } = await admin.from("notifications")
        .select("*")
        .eq("user_id", sender.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) return jsonResponse({ error: "Could not load notifications" }, 500);
      return jsonResponse({ notifications: data ?? [] });
    }

    if (action === "mark_read" || action === "delete" || action === "clear") {
      let query = admin.from("notifications");
      if (action === "mark_read") query = query.update({ is_read: body.isRead !== false });
      else query = query.delete();
      query = query.eq("user_id", sender.id);
      if (action !== "clear") {
        const id = typeof body.id === "string" ? body.id : "";
        if (!UUID_PATTERN.test(id)) return jsonResponse({ error: "Invalid notification ID" }, 400);
        query = query.eq("id", id);
      }
      const { error } = await query;
      if (error) return jsonResponse({ error: "Could not update notification" }, 500);
      await publishNotificationChange(admin, sender.id);
      return jsonResponse({ success: true });
    }

    if (action === "update_avatar") {
      const avatarUrl = typeof body.avatarUrl === "string" ? body.avatarUrl.trim() : "";
      try {
        const parsedUrl = new URL(avatarUrl);
        if (parsedUrl.protocol !== "https:" || parsedUrl.origin !== supabaseUrl) {
          return jsonResponse({ error: "Invalid profile image" }, 400);
        }
      } catch {
        return jsonResponse({ error: "Invalid profile image" }, 400);
      }
      const { error } = await admin.from("users").update({ avatar_url: avatarUrl }).eq("id", sender.id);
      if (error) return jsonResponse({ error: "Could not update profile image" }, 500);
      return jsonResponse({ success: true, avatarUrl });
    }

    if (action === "send" || action === "test") {
      const { recipients, error } = await resolveRecipients(admin, body, sender.id);
      if (error) return jsonResponse({ error }, 400);
      if (!recipients?.length) return jsonResponse({ success: true, delivered: 0, notificationCount: 0 });
      if (action === "test" && recipients.some((recipient) => recipient.id !== sender.id)) {
        return jsonResponse({ error: "A test notification can only target your own devices" }, 403);
      }
      return await sendNotifications(admin, sender, recipients, body);
    }

    return jsonResponse({ error: `Unsupported action: ${action}` }, 400);
  } catch (error) {
    const errMessage = errorMessage(error);
    console.error("Push function fatal error:", errMessage);
    return jsonResponse({ error: `Server error: ${errMessage}` }, 500);
  }
});