import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

export function useSubscription(userId?: string) {
  const [tier, setTier] = useState<"free" | "pro">("free");
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    async function fetchSubscription() {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("tier, status")
        .eq("user_id", userId)
        .single();

      if (!error && data && data.status === "active") {
        setTier(data.tier as "free" | "pro");
      }
      setLoading(false);
    }

    void fetchSubscription();
  }, [userId]);

  return { tier, loading };
}