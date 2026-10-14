// @ts-nocheck
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizePhone(value: string) {
  const digits = value.trim().replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") || "";
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "";
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@deloci.app";

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
        { status: 500, headers: corsHeaders }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const body = await req.json();
    let action = body.action;

    // Fixed: Added support for 'userId' (camelCase) alongside 'userIds' and 'user_id'
    const rawUserIds = body.userIds || body.user_id || body.userId;
    const targetUserIds: string[] = (Array.isArray(rawUserIds) ? rawUserIds : rawUserIds ? [rawUserIds] : [])
      .filter((id) => typeof id === "string" || typeof id === "number")
      .map(String)
      .map((id) => id.trim())
      .filter(Boolean);
    const targetUserUuids = targetUserIds.filter((id) => UUID_PATTERN.test(id));
    const emailAliases = Array.from(new Set(targetUserIds
      .filter((id) => !UUID_PATTERN.test(id) && EMAIL_PATTERN.test(id))
      .map(normalizeEmail)));
    const phoneAliases = Array.from(new Set(targetUserIds
      .filter((id) => !UUID_PATTERN.test(id) && !EMAIL_PATTERN.test(id))
      .flatMap((phone) => [phone.trim(), normalizePhone(phone)])
      .filter((phone) => /^\+?\d[\d\s().-]{6,18}$/.test(phone))));

    // Default action to "send" if target users are passed without explicit action
    if (!action && targetUserIds.length > 0) {
      action = "send";
    }

    // 1. SUBSCRIBE ACTION
    if (action === "subscribe") {
      const { user_id, userId, endpoint, p256dh, auth, device_info } = body;
      const subUserId = user_id || userId;

      if (!subUserId || !endpoint || !p256dh || !auth) {
        return new Response(
          JSON.stringify({ error: "Missing required parameters: user_id/userId, endpoint, p256dh, auth" }),
          { status: 400, headers: corsHeaders }
        );
      }

      const normalizedSubUserId = String(subUserId);
      const userLookup = UUID_PATTERN.test(normalizedSubUserId)
        ? await supabaseAdmin.from("users").select("id, phone").eq("id", normalizedSubUserId).maybeSingle()
        : EMAIL_PATTERN.test(normalizedSubUserId)
        ? await supabaseAdmin.from("users").select("id, phone").eq("email", normalizeEmail(normalizedSubUserId)).maybeSingle()
        : await supabaseAdmin.from("users").select("id, phone").eq("phone", normalizePhone(normalizedSubUserId)).maybeSingle();

      if (userLookup.error || !userLookup.data) {
        return new Response(
          JSON.stringify({ error: userLookup.error?.message || "Could not resolve subscription user" }),
          { status: userLookup.error ? 500 : 404, headers: corsHeaders }
        );
      }

      const { data, error } = await supabaseAdmin
        .from("user_push_subscriptions")
        .upsert(
          {
            user_id: userLookup.data.id,
            user_phone: normalizePhone(userLookup.data.phone),
            endpoint,
            p256dh,
            auth,
            device_info: device_info || null,
            is_active: true,
          },
          { onConflict: "endpoint" }
        )
        .select();

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: corsHeaders }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: corsHeaders }
      );
    }

    // 2. SEND / TEST ACTION
    if (action === "send" || action === "test") {
      if (!vapidPublicKey || !vapidPrivateKey) {
        return new Response(
          JSON.stringify({ error: "Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY environment variables" }),
          { status: 500, headers: corsHeaders }
        );
      }

      if (targetUserIds.length === 0) {
        // Return 200 with 0 delivered instead of 400 to prevent client-side FunctionsHttpError crashes
        return new Response(
          JSON.stringify({ success: true, delivered: 0, message: "Missing target user ID(s) in request body" }),
          { status: 200, headers: corsHeaders }
        );
      }

      webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

      let resolvedUserUuids = targetUserUuids;
      let searchPhones = phoneAliases;

      const userQueries = [];
      if (phoneAliases.length > 0) {
        userQueries.push(supabaseAdmin
          .from("users")
          .select("id, phone")
          .in("phone", phoneAliases));
      }
      if (emailAliases.length > 0) {
        userQueries.push(supabaseAdmin
          .from("users")
          .select("id, phone")
          .in("email", emailAliases));
      }

      const userResults = await Promise.all(userQueries);
      const userError = userResults.find((result) => result.error)?.error;
      if (userError) {
        return new Response(
          JSON.stringify({ error: userError.message }),
          { status: 500, headers: corsHeaders }
        );
      }

      if (userResults.length > 0) {
        const matchingUsers = userResults.flatMap((result) => result.data || []);
        resolvedUserUuids = Array.from(new Set([
          ...resolvedUserUuids,
          ...(matchingUsers || []).map((user) => user.id),
        ]));
        searchPhones = Array.from(new Set([
          ...searchPhones,
          ...(matchingUsers || []).map((user) => normalizePhone(user.phone)),
        ].filter(Boolean)));
      }

      const subscriptionQueries = [];
      if (resolvedUserUuids.length > 0) {
        subscriptionQueries.push(
          supabaseAdmin.from("user_push_subscriptions").select("*").in("user_id", resolvedUserUuids).eq("is_active", true)
        );
      }
      if (searchPhones.length > 0) {
        subscriptionQueries.push(
          supabaseAdmin.from("user_push_subscriptions").select("*").in("user_phone", searchPhones).eq("is_active", true)
        );
      }

      const queryResults = await Promise.all(subscriptionQueries);
      const errorResult = queryResults.find((result) => result.error);
      if (errorResult?.error) {
        return new Response(
          JSON.stringify({ error: errorResult.error.message }),
          { status: 500, headers: corsHeaders }
        );
      }

      const subscriptions = Array.from(new Map(
        queryResults.flatMap((result) => result.data || []).map((subscription) => [subscription.endpoint, subscription])
      ).values());

      if (!subscriptions || subscriptions.length === 0) {
        // Return 200 instead of 404 so client doesn't throw a FunctionsHttpError when a user has no subscriptions yet
        return new Response(
          JSON.stringify({ success: true, delivered: 0, message: "No active subscriptions found for target user(s)" }),
          { status: 200, headers: corsHeaders }
        );
      }

      const payload = JSON.stringify({
        title: body.title || "Déloci Alert",
        body: body.body || "Safety check-in notification",
        url: body.url || "/",
        tag: body.tag || "deloci-safety-alert",
      });

      // High-priority headers to prevent background throttling on Android/iOS
      const pushOptions = {
        headers: {
          Urgency: "high",
        },
        TTL: 60, // 60 seconds delivery window for immediate safety alerts
      };

      const rawResults = await Promise.allSettled(
        subscriptions.map(async (sub) => {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          };
          try {
            return await webpush.sendNotification(pushSubscription, payload, pushOptions);
          } catch (err: any) {
            // Automatically deactivate stale or expired subscriptions (410 Gone / 404 Not Found)
            if (err.statusCode === 410 || err.statusCode === 404) {
              await supabaseAdmin
                .from("user_push_subscriptions")
                .update({ is_active: false })
                .eq("id", sub.id);
            }
            throw err;
          }
        })
      );

      const formattedResults = rawResults.map((r) => ({
        ok: r.status === "fulfilled",
        status: r.status === "fulfilled" ? 201 : r.reason?.statusCode || 500,
        statusCode: r.status === "fulfilled" ? 201 : r.reason?.statusCode || 500,
        value: r.status === "fulfilled" ? r.value : null,
        reason: r.status === "rejected" ? r.reason?.message || String(r.reason) : null,
      }));

      const successfulCount = formattedResults.filter((r) => r.ok).length;

      return new Response(
        JSON.stringify({
          success: true,
          count: successfulCount,
          delivered: successfulCount,
          results: formattedResults,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ error: `Invalid action: ${action}` }),
      { status: 400, headers: corsHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Server Error" }),
      { status: 500, headers: corsHeaders }
    );
  }
});