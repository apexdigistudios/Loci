import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    let event;

    try {
      event = JSON.parse(rawBody);
    } catch (e) {
      console.error("Failed to parse webhook JSON:", e);
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const eventType = event.event_type;
    const data = event.data;

    console.log(`[Paddle Webhook] Received event: ${eventType}`);

    if (!data) {
      return NextResponse.json({ received: true, note: "No data field" }, { status: 200 });
    }

    const customData = data.custom_data || data.customData || {};
    const userId = customData.user_id;

    if (!userId) {
      console.warn("[Paddle Webhook] Event received without user_id in custom_data");
      return NextResponse.json({ received: true, note: "Missing user_id" }, { status: 200 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    if (
      eventType === "subscription.created" ||
      eventType === "subscription.updated" ||
      eventType === "subscription.activated" ||
      eventType === "transaction.completed"
    ) {
      const subscriptionId = data.id || data.subscription_id || `sub_${Date.now()}`;
      const status = data.status || "active";
      const items = data.items?.[0];
      const currentPeriodEnd = items?.current_billing_period?.ends_at || data.current_billing_period?.ends_at;

      const { error: upsertError } = await supabaseAdmin.from("subscriptions").upsert(
        {
          user_id: userId,
          paddle_subscription_id: subscriptionId,
          status: status,
          tier: "plus",
          current_period_end: currentPeriodEnd || null,
        },
        { onConflict: "paddle_subscription_id" }
      );

      if (upsertError) {
        console.error("[Paddle Webhook] Supabase upsert error:", upsertError.message);
        return NextResponse.json({ error: upsertError.message }, { status: 200 });
      }

      console.log(`[Paddle Webhook] Successfully upgraded user ${userId} to PLUS tier.`);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: any) {
    console.error("[Paddle Webhook] Unhandled error:", error);
    return NextResponse.json({ error: error.message }, { status: 200 });
  }
}