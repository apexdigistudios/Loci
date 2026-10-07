// @ts-nocheck
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

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

    // Normalize user ID inputs (supports single string or array of IDs via userIds / user_id)
    const rawUserIds = body.userIds || body.user_id;
    const targetUserIds: string[] = Array.isArray(rawUserIds)
      ? rawUserIds
      : rawUserIds
      ? [rawUserIds]
      : [];

    // Default action to "send" if target users are passed without explicit action
    if (!action && targetUserIds.length > 0) {
      action = "send";
    }

    // 1. SUBSCRIBE ACTION
    if (action === "subscribe") {
      const { user_id, endpoint, p256dh, auth, device_info } = body;

      if (!user_id || !endpoint || !p256dh || !auth) {
        return new Response(
          JSON.stringify({ error: "Missing required parameters: user_id, endpoint, p256dh, auth" }),
          { status: 400, headers: corsHeaders }
        );
      }

      const { data, error } = await supabaseAdmin
        .from("user_push_subscriptions")
        .upsert(
          { user_id, endpoint, p256dh, auth, device_info: device_info || null, is_active: true },
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
        return new Response(
          JSON.stringify({ error: "Missing target user ID(s) in request body" }),
          { status: 400, headers: corsHeaders }
        );
      }

      webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

      // Query active push subscriptions across all target user IDs
      const { data: subscriptions, error } = await supabaseAdmin
        .from("user_push_subscriptions")
        .select("*")
        .in("user_id", targetUserIds)
        .eq("is_active", true);

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: corsHeaders }
        );
      }

      if (!subscriptions || subscriptions.length === 0) {
        return new Response(
          JSON.stringify({ error: "No active subscriptions found for target user(s)", delivered: 0 }),
          { status: 404, headers: corsHeaders }
        );
      }

      const payload = JSON.stringify({
        title: body.title || "Déloci Alert",
        body: body.body || "Safety check-in notification",
        url: body.url || "/",
        tag: body.tag || "loci-alert",
      });

      const rawResults = await Promise.allSettled(
        subscriptions.map(async (sub) => {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          };
          try {
            return await webpush.sendNotification(pushSubscription, payload);
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