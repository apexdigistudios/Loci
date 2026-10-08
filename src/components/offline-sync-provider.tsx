"use client";

import { useEffect } from "react";
import { flushOfflineQueue } from "@/lib/offline-sync";

export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Flush queued actions on app launch
    void flushOfflineQueue();

    // Listener for when connectivity is restored
    const handleOnline = () => {
      void flushOfflineQueue();
    };

    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return <>{children}</>;
}