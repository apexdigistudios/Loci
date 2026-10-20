"use client";

import { useEffect } from "react";
import { initializePaddle } from "@paddle/paddle-js";

export function PaddleProvider() {
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;

    if (!token) {
      console.error("Missing Paddle client-side token in environment variables.");
      return;
    }

    initializePaddle({
      environment: "sandbox",
      token,
    })
      .then((paddleInstance) => {
        if (paddleInstance) {
          console.log("Paddle initialized successfully.");
        }
      })
      .catch((error) => {
        console.error("Failed to initialize Paddle:", error);
      });
  }, []);

  return null;
}