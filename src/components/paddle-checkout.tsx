"use client";

import React, { useState } from "react";
import { Zap, Loader2 } from "lucide-react";

interface PaddleCheckoutProps {
  userEmail: string;
  userId: string;
  monthlyPriceId?: string;
  yearlyPriceId?: string;
}

export function PaddleCheckout({ userEmail, userId, monthlyPriceId, yearlyPriceId }: PaddleCheckoutProps) {
  const [loadingInterval, setLoadingInterval] = useState<"monthly" | "yearly" | null>(null);

  const openCheckout = (interval: "monthly" | "yearly", priceId?: string) => {
    if (!priceId) {
      alert(`Missing ${interval} price ID. Please check your .env.local file.`);
      return;
    }

    setLoadingInterval(interval);
    
    const Paddle = (window as unknown as { Paddle?: { Checkout: { open: (arg: unknown) => void } } }).Paddle;

    if (!Paddle) {
      setLoadingInterval(null);
      alert("Paddle SDK is still loading or failed to initialize. Please check your connection.");
      return;
    }

    Paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customer: { email: userEmail },
      customData: { user_id: userId },
      settings: {
        displayMode: "overlay",
        successUrl: `${window.location.origin}/main?tab=profile&success=true`,
      },
    });
    
    setLoadingInterval(null);
  };

  const monthlyId = monthlyPriceId || process.env.NEXT_PUBLIC_PADDLE_PLUS_MONTHLY_PRICE_ID || "";
  const yearlyId = yearlyPriceId || process.env.NEXT_PUBLIC_PADDLE_PLUS_YEARLY_PRICE_ID || "";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <button
        type="button"
        onClick={() => openCheckout("monthly", monthlyId)}
        disabled={loadingInterval !== null}
        className="bg-linear-to-r from-yellow-400 to-amber-400 hover:from-yellow-300 hover:to-amber-300 text-black p-4 rounded-[26px] flex items-center justify-between active:scale-[0.98] transition-all shadow-lg shadow-yellow-400/20 group"
      >
        {loadingInterval === "monthly" ? (
          <Loader2 className="w-4 h-4 animate-spin text-black" />
        ) : (
          <>
            <Zap className="w-4 h-4 fill-black" />
            <span>Subscribe Monthly ($2.99)</span>
          </>
        )}
      </button>

      <button
        type="button"
        onClick={() => openCheckout("yearly", yearlyId)}
        disabled={loadingInterval !== null}
        className="bg-linear-to-r from-zinc-900 to-zinc-800 dark:from-white dark:to-zinc-200 hover:from-zinc-800 dark:hover:from-zinc-200 text-white dark:text-black font-extrabold py-3.5 px-4 rounded-2xl text-xs transition-all flex items-center justify-center space-x-2 active:scale-98 shadow-md"
      >
        {loadingInterval === "yearly" ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <Zap className="w-4 h-4 fill-current" />
            <span>Subscribe Yearly ($29.99)</span>
          </>
        )}
      </button>
    </div>
  );
}