"use client";

import React, { useEffect, useState } from "react";
import { Zap, Loader2 } from "lucide-react";

interface PaddleCheckoutProps {
  userEmail: string;
  userId: string;
  priceId: string; // Your Paddle Price ID
}

export function PaddleCheckout({ userEmail, userId, priceId }: PaddleCheckoutProps) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load Paddle JS script dynamically
    const script = document.createElement("script");
    script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const openCheckout = () => {
    setLoading(true);
    const Paddle = (window as unknown as { Paddle?: { Initialize: (arg: { environment: string; token: string }) => void; Checkout: { open: (arg: unknown) => void } } }).Paddle;

    if (!Paddle) {
      setLoading(false);
      alert("Paddle SDK failed to load. Please check your connection.");
      return;
    }

    // Initialize Paddle with your client token
    Paddle.Initialize({
      environment: process.env.NODE_ENV === "production" ? "production" : "sandbox",
      token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || "",
    });

    Paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customer: { email: userEmail },
      customData: { user_id: userId },
      settings: {
        successUrl: `${window.location.origin}/main?tab=profile&success=true`,
      },
    });
    setLoading(false);
  };

  return (
    <button
      type="button"
      onClick={openCheckout}
      disabled={loading}
      className="w-full bg-yellow-400 hover:bg-yellow-300 text-black font-extrabold py-3.5 px-6 rounded-2xl text-xs transition-all flex items-center justify-center space-x-2 active:scale-98 shadow-md shadow-yellow-400/20"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-black" />
      ) : (
        <>
          <Zap className="w-4 h-4 fill-black" />
          <span>Upgrade to Pro Tier</span>
        </>
      )}
    </button>
  );
}