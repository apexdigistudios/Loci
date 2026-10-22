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
      console.log("🔍 [useSubscription] Checking tier for userId:", userId, "userPhone:", userPhone);
      try {
        let targetUserId = userId;

        if (!targetUserId && userPhone) {
          const { data: userData, error: userErr } = await supabase
            .from("users")
            .select("id, subscription_tier, tier")
            .eq("phone", cleanPhone(userPhone))
            .maybeSingle();

          console.log("🔍 [useSubscription] User lookup by phone result:", userData, "Error:", userErr);
          if (userData?.id) {
            targetUserId = userData.id;
          }

          const directTier = (userData?.subscription_tier || userData?.tier || "").toLowerCase();
          if (directTier === "plus") {
            console.log("✨ [useSubscription] Found Plus in users table directly.");
            if (!cancelled) { setTier("plus"); setLoading(false); }
            return;
          }
        }

        if (!targetUserId) {
          console.log("⚠️ [useSubscription] No userId found. Defaulting to free.");
          if (!cancelled) { setTier("free"); setLoading(false); }
          return;
        }

        // Query subscriptions table by user_id
        const { data: subData, error: subErr } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", targetUserId);

        console.log("🔍 [useSubscription] Subscriptions table query result:", subData, "Error:", subErr);

        if (subData && subData.length > 0) {
          const hasPlus = subData.some(
            (row: any) =>
              row.tier?.toLowerCase() === "plus" || row.status?.toLowerCase() === "active"
          );
          if (hasPlus) {
            console.log("✨ [useSubscription] Plus tier confirmed via subscriptions table!");
            if (!cancelled) { setTier("plus"); setLoading(false); }
            return;
          }
        }

        // Fallback: check users table by targetUserId
        const { data: userRec, error: userRecErr } = await supabase
          .from("users")
          .select("subscription_tier, tier")
          .eq("id", targetUserId)
          .maybeSingle();

        console.log("🔍 [useSubscription] User record query result:", userRec, "Error:", userRecErr);
        const userRecTier = (userRec?.subscription_tier || userRec?.tier || "").toLowerCase();
        if (userRecTier === "plus") {
          console.log("✨ [useSubscription] Plus tier confirmed via users table record!");
          if (!cancelled) { setTier("plus"); setLoading(false); }
          return;
        }

        console.log("🔒 [useSubscription] No Plus match found. Defaulting to free.");
        if (!cancelled) setTier("free");
      } catch (err) {
        console.error("❌ [useSubscription] Exception caught:", err);
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