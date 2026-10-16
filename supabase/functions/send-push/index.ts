import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-loci-session",
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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function normalizePhone(value: string) {
  const digits = value.trim().replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string) {
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
}

function makeSessionToken() {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

async function verifyPin(pin: string, storedHash: string | null) {
  if (!storedHash) return false;
  const [algorithm, iterationText, saltHex, expectedHex] = storedHash.split("$");
  const iterations = Number(iterationText);
  if (
    algorithm !== "pbkdf2" ||
    !/^\d+$/.test(iterationText || "") ||
    !Number.isSafeInteger(iterations) ||
    iterations < 100000 ||
    iterations > 1000000 ||
    !/^[\da-f]{32}$/i.test(saltHex || "") ||
    !/^[\da-f]{64}$/i.test(expectedHex || "")
  ) return false;

  const passwordKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derived = new Uint8Array(await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new Uint8Array((saltHex.match(/.{2}/g) || []).map((pair) => Number.parseInt(pair, 16))),
      iterations,
      hash: "SHA-256",
    },
    passwordKey,
    256
  ));
  const expected = new Uint8Array((expectedHex.match(/.{2}/g) || []).map((pair) => Number.parseInt(pair, 16)));
  if (derived.length !== expected.length) return false;
  return derived.reduce((difference, byte, index) => difference | (byte ^ expected[index]), 0) === 0;
}

async function publishNotificationChange(admin: ReturnType<typeof createClient>, userId: string) {
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
    await channel.send({
      type: "broadcast",
      event: "changed",
      payload: { userId },
    });
  } catch (error) {
    console.warn("Notification refresh broadcast failed:", error);
  } finally {
    await admin.removeChannel(channel);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: "Notification service is not configured" }, 500);

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const body = await req.json();
    const action = typeof body.action === "string" ? body.action : "";

    if (action === "check_pin_status") {
      const phone = normalizePhone(String(body.phone || ""));
      if (!/^\+\d{8,15}$/.test(phone)) return jsonResponse({ error: "Invalid phone number" }, 400);
      const { data, error } = await admin.from("users").select("pin_hash").eq("phone", phone).maybeSingle();
      if (error) return jsonResponse({ error: "Could not check PIN status" }, 500);
      return jsonResponse({ hasPin: !!data?.pin_hash });
    }

    if (action === "create_session") {
      const userId = String(body.userId || "").trim();
      const phone = normalizePhone(String(body.phone || ""));
      const pin = String(body.pin || "");
      if (!UUID_PATTERN.test(userId) || !/^\+\d{8,15}$/.test(phone) || !/^\d{4}$/.test(pin)) {
        return jsonResponse({ error: "Invalid sign-in details" }, 400);
      }

      const { data: allowed, error: attemptError } = await admin.rpc("begin_notification_pin_attempt", { p_phone: phone });
      if (attemptError) return jsonResponse({ error: "Could not verify sign-in" }, 500);
      if (!allowed) return jsonResponse({ error: "Too many attempts. Try again in 15 minutes." }, 429);

      const { data: user, error: userError } = await admin
        .from("users")
        .select("id, phone, pin_hash")
        .eq("id", userId)
        .eq("phone", phone)
        .maybeSingle();
      if (userError) return jsonResponse({ error: "Could not verify sign-in" }, 500);
      if (!user || !(await verifyPin(pin, user.pin_hash))) {
        return jsonResponse({ error: "Invalid sign-in details" }, 401);
      }

      await admin.rpc("reset_notification_pin_attempt", { p_phone: phone });
      const token = makeSessionToken();
      const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
      const { error: sessionError } = await admin.from("notification_app_sessions").insert({
        token_hash: await sha256(token),
        user_id: user.id,
        expires_at: expiresAt,
      });
      if (sessionError) return jsonResponse({ error: "Could not establish notification session" }, 500);
      await admin.from("notification_app_sessions").delete().lt("expires_at", new Date().toISOString());
      return jsonResponse({ token, expiresAt });
    }

    const rawToken = req.headers.get("x-loci-session") || "";
    if (!/^[\da-f]{64}$/i.test(rawToken)) return jsonResponse({ error: "Valid notification session required" }, 401);
    const { data: session, error: sessionError } = await admin
      .from("notification_app_sessions")
      .select("user_id")
      .eq("token_hash", await sha256(rawToken))
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (sessionError) return jsonResponse({ error: "Could not verify notification session" }, 500);
    if (!session) return jsonResponse({ error: "Notification session expired" }, 401);

    const { data: sender, error: senderError } = await admin
      .from("users")
      .select("id, phone")
      .eq("id", session.user_id)
      .maybeSingle();
    if (senderError || !sender) return jsonResponse({ error: "Notification profile not found" }, 401);

    if (action === "end_session") {
      const { error } = await admin.from("notification_app_sessions").delete().eq("token_hash", await sha256(rawToken));
      if (error) return jsonResponse({ error: "Could not end notification session" }, 500);
      return jsonResponse({ success: true });
    }

    if (action === "subscribe") {
      const { endpoint, p256dh, auth, deviceInfo } = body;
      let endpointUrl: URL;
      try {
        endpointUrl = new URL(endpoint);
      } catch {
        return jsonResponse({ error: "Invalid push endpoint" }, 400);
      }
      if (endpointUrl.protocol !== "https:" || !p256dh || !auth) {
        return jsonResponse({ error: "Invalid push subscription" }, 400);
      }
      const { error } = await admin.from("user_push_subscriptions").upsert({
        user_id: sender.id,
        endpoint: endpointUrl.toString(),
        p256dh,
        auth,
        device_info: deviceInfo && typeof deviceInfo === "object" ? deviceInfo : {},
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "endpoint" });
      if (error) return jsonResponse({ error: "Could not save device subscription" }, 500);
      return jsonResponse({ success: true });
    }

    if (action === "subscription_count") {
      const { count, error } = await admin
        .from("user_push_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", sender.id)
        .eq("is_active", true);
      if (error) return jsonResponse({ error: "Could not check device subscriptions" }, 500);
      return jsonResponse({ count: count || 0 });
    }

    if (action === "list" || action === "unread_count") {
      let query = admin.from("notifications").select("*", action === "unread_count" ? { count: "exact", head: true } : undefined)
        .eq("user_id", sender.id);
      if (action === "unread_count") {
        query = query.eq("is_read", false);
        const { count, error } = await query;
        if (error) return jsonResponse({ error: "Could not load notification count" }, 500);
        return jsonResponse({ count: count || 0 });
      }
      const { data, error } = await query.order("created_at", { ascending: false }).limit(100);
      if (error) return jsonResponse({ error: "Could not load notifications" }, 500);
      return jsonResponse({ notifications: data || [] });
    }

    if (action === "mark_read" || action === "delete" || action === "clear") {
      let query = admin.from("notifications");
      if (action === "mark_read") {
        query = query.update({ is_read: body.isRead !== false });
      } else {
        query = query.delete();
      }
      query = query.eq("user_id", sender.id);
      if (action !== "clear") {
        if (!UUID_PATTERN.test(String(body.id || ""))) return jsonResponse({ error: "Invalid notification ID" }, 400);
        query = query.eq("id", body.id);
      }
      const { error } = await query;
      if (error) return jsonResponse({ error: "Could not update notification" }, 500);
      await publishNotificationChange(admin, sender.id);
      return jsonResponse({ success: true });
    }

    if (action !== "send" && action !== "test") return jsonResponse({ error: `Invalid action: ${action}` }, 400);

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") || "";
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "";
    if (!vapidPublicKey || !vapidPrivateKey) return jsonResponse({ error: "Push delivery is not configured" }, 500);

    const requestedTargets = [
      ...(Array.isArray(body.userIds) ? body.userIds : []),
      ...(Array.isArray(body.userIds) ? [] : [body.userId || body.user_id].filter(Boolean)),
      ...(Array.isArray(body.phones) ? body.phones : []),
      ...(Array.isArray(body.emails) ? body.emails : []),
      ...(body.phone ? [body.phone] : []),
      ...(body.email ? [body.email] : []),
    ].filter((target) => typeof target === "string").map((target) => target.trim()).filter(Boolean);

    if (requestedTargets.length === 0) return jsonResponse({ success: true, delivered: 0 });

    const targetIds = new Set<string>();
    const targetPhones = new Set<string>();
    const targetEmails = new Set<string>();
    for (const target of requestedTargets) {
      if (UUID_PATTERN.test(target)) targetIds.add(target);
      else if (EMAIL_PATTERN.test(target)) targetEmails.add(normalizeEmail(target));
      else if (PHONE_PATTERN.test(target)) targetPhones.add(normalizePhone(target));
      else return jsonResponse({ error: "Invalid notification recipient" }, 400);
    }

    const targetQueries = [];
    if (targetIds.size) targetQueries.push(admin.from("users").select("id, phone").in("id", [...targetIds]));
    if (targetPhones.size) targetQueries.push(admin.from("users").select("id, phone").in("phone", [...targetPhones]));
    if (targetEmails.size) targetQueries.push(admin.from("users").select("id, phone").in("email", [...targetEmails]));
    const targetResults = await Promise.all(targetQueries);
    const targetError = targetResults.find((result) => result.error)?.error;
    if (targetError) return jsonResponse({ error: "Could not resolve notification recipients" }, 500);
    const recipients = Array.from(new Map(targetResults.flatMap((result) => result.data || []).map((user) => [user.id, user])).values());
    if (recipients.length === 0) return jsonResponse({ success: true, delivered: 0, message: "No registered recipients found" });
    if (action === "test" && recipients.some((recipient) => recipient.id !== sender.id)) {
      return jsonResponse({ error: "A test notification can only target your own devices" }, 403);
    }

    const { data: contacts, error: contactsError } = await admin
      .from("trusted_contacts")
      .select("phone")
      .eq("user_phone", sender.phone);
    if (contactsError) return jsonResponse({ error: "Could not verify recipient permissions" }, 500);
    const allowedPhones = new Set((contacts || []).map((contact) => normalizePhone(contact.phone)));
    const unauthorized = recipients.find((recipient) => recipient.id !== sender.id && !allowedPhones.has(normalizePhone(recipient.phone)));
    if (unauthorized) return jsonResponse({ error: "Recipient is not in your trusted contacts" }, 403);

    const requestedType = typeof body.type === "string" && NOTIFICATION_TYPES.has(body.type) ? body.type : "update";
    const title = typeof body.title === "string" ? body.title.slice(0, 160) : "Déloci Alert";
    const message = typeof body.body === "string" ? body.body.slice(0, 2000) : "Safety update received.";
    const metadata = {
      ...(body.metadata && typeof body.metadata === "object" ? body.metadata : {}),
      url: typeof body.url === "string" ? body.url : "/",
      tag: typeof body.tag === "string" ? body.tag.slice(0, 100) : "deloci-alert",
    };

    const { data: notifications, error: insertError } = await admin.from("notifications").insert(
      recipients.map((recipient) => ({
        user_id: recipient.id,
        sender_id: sender.id,
        title,
        message,
        type: requestedType,
        metadata,
      }))
    ).select("id, user_id");
    if (insertError) return jsonResponse({ error: "Could not save notification" }, 500);

    webpush.setVapidDetails(
      Deno.env.get("VAPID_SUBJECT") || "mailto:admin@deloci.app",
      vapidPublicKey,
      vapidPrivateKey
    );
    const recipientIds = recipients.map((recipient) => recipient.id);
    const { data: subscriptions, error: subscriptionError } = await admin
      .from("user_push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth")
      .in("user_id", recipientIds)
      .eq("is_active", true);
    if (subscriptionError) return jsonResponse({ error: "Could not load device subscriptions" }, 500);

    const payload = JSON.stringify({
      title,
      body: message,
      type: requestedType,
      url: metadata.url,
      tag: metadata.tag,
      metadata,
    });
    const pushOptions = { headers: { Urgency: "high" }, TTL: 60 };
    const results = await Promise.allSettled((subscriptions || []).map(async (subscription) => {
      try {
        return await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        }, payload, pushOptions);
      } catch (error) {
        if (error.statusCode === 404 || error.statusCode === 410) {
          await admin.from("user_push_subscriptions").update({ is_active: false }).eq("id", subscription.id);
        }
        throw error;
      }
    }));

    await Promise.all(recipients.map((recipient) => publishNotificationChange(admin, recipient.id)));
    return jsonResponse({
      success: true,
      notificationCount: notifications?.length || 0,
      delivered: results.filter((result) => result.status === "fulfilled").length,
      failures: results.filter((result) => result.status === "rejected").length,
    });
  } catch (error) {
    console.error("Notification request failed:", error);
    return jsonResponse({ error: "Notification request failed" }, 500);
  }
});