import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { cleanPhone } from "@/lib/utils";

export type SubscriptionTier = "free" | "plus";

export function useSubscription(userId?: string | null, userPhone?: string | null) {
  const [tier, setTier] = useState<SubscriptionTier>("free");
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchSubscription() {
      setLoading(true);
      try {
        let targetUserId = userId;

        // 1. If no userId provided, try finding the user by phone
        if (!targetUserId && userPhone) {
          const { data: userData, error: userErr } = await supabase
            .from("users")
            .select("id, subscription_tier, tier")
            .eq("phone", cleanPhone(userPhone))
            .maybeSingle();

          if (userErr) {
            console.warn("useSubscription: Error fetching user by phone:", userErr.message);
          }

          if (userData?.id) {
            targetUserId = userData.id;
          }

          // Check if subscription tier is stored directly on the users record
          const userDirectTier = (userData?.subscription_tier || userData?.tier || "").toLowerCase();
          if (userDirectTier === "plus") {
            if (!cancelled) {
              setTier("plus");
              setLoading(false);
            }
            return;
          }
        }

        // 2. If we have a targetUserId, check the subscriptions table
        if (targetUserId) {
          const { data: subData, error: subErr } = await supabase
            .from("subscriptions")
            .select("tier, status")
            .eq("user_id", targetUserId)
            .maybeSingle();

          if (subErr) {
            console.warn("useSubscription: Error querying subscriptions table:", subErr.message);
          }

          if (subData && subData.status === "active" && subData.tier?.toLowerCase() === "plus") {
            if (!cancelled) {
              setTier("plus");
              setLoading(false);
            }
            return;
          }

          // 3. Fallback: check users table by targetUserId
          const { data: userRecord } = await supabase
            .from("users")
            .select("subscription_tier, tier")
            .eq("id", targetUserId)
            .maybeSingle();

          const recordTier = (userRecord?.subscription_tier || userRecord?.tier || "").toLowerCase();
          if (recordTier === "plus") {
            if (!cancelled) {
              setTier("plus");
              setLoading(false);
            }
            return;
          }
        }

        if (!cancelled) setTier("free");
      } catch (error) {
        console.error("useSubscription critical error:", error);
        if (!cancelled) setTier("free");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchSubscription();

    return () => {
      cancelled = true;
    };
  }, [userId, userPhone]);

  return { tier, loading };
}