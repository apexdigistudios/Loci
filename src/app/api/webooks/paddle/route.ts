import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase admin client for secure backend updates
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const eventType = body.event_type;
    const data = body.data;

    // Handle Subscription Creation or Updates
    if (
      eventType === "subscription.created" ||
      eventType === "subscription.updated"
    ) {
      const subscriptionId = data.id;
      const status = data.status; // 'active', 'trialing', 'past_due', etc.
      const customerId = data.customer_id;
      const customData = data.custom_data; // Contains user_id passed during checkout
      const userId = customData?.user_id;
      const items = data.items?.[0];
      const currentPeriodEnd = items?.current_billing_period?.ends_at;

      if (userId) {
        await supabaseAdmin.from("subscriptions").upsert(
          {
            user_id: userId,
            paddle_subscription_id: subscriptionId,
            status: status,
            tier: status === "active" ? "pro" : "free",
            current_period_end: currentPeriodEnd,
          },
          { onConflict: "paddle_subscription_id" }
        );
      }
    }

    // Handle Subscription Cancellation
    if (eventType === "subscription.canceled") {
      const subscriptionId = data.id;

      await supabaseAdmin
        .from("subscriptions")
        .update({ status: "canceled", tier: "free" })
        .eq("paddle_subscription_id", subscriptionId);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("Paddle webhook error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}