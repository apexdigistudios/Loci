import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

export type SubscriptionTier = "free" | "plus";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

export function useSubscription(userId?: string) {
  const [tier, setTier] = useState<SubscriptionTier>("free");
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      queueMicrotask(() => {
        if (cancelled) return;
        setTier("free");
        setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }

    async function fetchSubscription() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("subscriptions")
          .select("tier, status")
          .eq("user_id", userId)
          .maybeSingle();

        if (error) throw error;
        if (!cancelled) {
          setTier(data?.status === "active" && data.tier === "plus" ? "plus" : "free");
        }
      } catch (error) {
        console.warn("Could not load subscription tier:", error);
        if (!cancelled) setTier("free");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchSubscription();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { tier, loading };
}