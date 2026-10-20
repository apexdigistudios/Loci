import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("PADDLE WEBHOOK RECEIVED:", JSON.stringify(body, null, 2));

    const eventType = body.event_type;
    const data = body.data;

    if (!data) {
      return NextResponse.json({ error: "No data payload" }, { status: 400 });
    }

    // Support both custom_data and customData formats
    const customData = data.custom_data || data.customData;
    const userId = customData?.user_id;

    console.log("Parsed Webhook - Event:", eventType, "UserId:", userId);

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

      if (userId) {
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
          console.error("Supabase upsert error:", upsertError);
          return NextResponse.json({ error: upsertError.message }, { status: 500 });
        }
        console.log("Successfully updated subscription to PLUS for user:", userId);
      } else {
        console.warn("Webhook received without user_id in custom_data:", body);
      }
    }

    if (eventType === "subscription.canceled" || eventType === "subscription.past_due") {
      const subscriptionId = data.id;
      if (subscriptionId) {
        await supabaseAdmin
          .from("subscriptions")
          .update({ status: "canceled", tier: "free" })
          .eq("paddle_subscription_id", subscriptionId);
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("Paddle webhook processing error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed", details: String(error) },
      { status: 500 }
    );
  }
}