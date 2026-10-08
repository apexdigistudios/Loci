"use client";

import React from "react";
import { MapPin } from "lucide-react";

export function SplashScreen() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-black transition-colors duration-300">
      {/* Continuous Bouncing Location Icon Only */}
      <div className="animate-bounce p-4 rounded-full bg-zinc-100 dark:bg-zinc-900/60 shadow-lg border border-zinc-200/50 dark:border-zinc-800/50">
        <MapPin className="w-16 h-16 text-black dark:text-white fill-black dark:fill-white stroke-[1.5]" />
      </div>
    </div>
  );
}