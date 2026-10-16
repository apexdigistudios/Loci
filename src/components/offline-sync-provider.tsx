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
    const handleServiceWorkerMessage = (event: MessageEvent<{ type?: string }>) => {
      if (event.data?.type === "FLUSH_OFFLINE_QUEUE") void flushOfflineQueue();
    };

    window.addEventListener("online", handleOnline);
    navigator.serviceWorker?.addEventListener("message", handleServiceWorkerMessage);
    return () => {
      window.removeEventListener("online", handleOnline);
      navigator.serviceWorker?.removeEventListener("message", handleServiceWorkerMessage);
    };
  }, []);

  return <>{children}</>;
}