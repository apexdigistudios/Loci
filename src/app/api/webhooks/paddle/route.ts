import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Add GET so you can test it directly in your browser
export async function GET() {
  return NextResponse.json({ status: "Webhook endpoint is active and working!" }, { status: 200 });
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    let event;

    try {
      event = JSON.parse(rawBody);
    } catch (e) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const eventType = event.event_type;
    const data = event.data;

    if (!data) {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const customData = data.custom_data || data.customData || {};
    const userId = customData.user_id;

    if (!userId) {
      return NextResponse.json({ received: true }, { status: 200 });
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

      await supabaseAdmin.from("subscriptions").upsert(
        {
          user_id: userId,
          paddle_subscription_id: subscriptionId,
          status: status,
          tier: "plus",
          current_period_end: currentPeriodEnd || null,
        },
        { onConflict: "paddle_subscription_id" }
      );
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 200 });
  }
}