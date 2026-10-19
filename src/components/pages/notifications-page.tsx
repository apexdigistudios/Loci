"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Bell,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Flag,
  Loader2,
  Mail,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { invokeNotificationApi } from "@/lib/notification-api";
import { getFriendlyErrorMessage } from "@/lib/friendly-errors";

type NotificationType = "session_start" | "checkin" | "emergency" | "session_end" | "update" | "guardian_alert";

interface NotificationItem {
  id: string;
  user_id: string;
  sender_id: string | null;
  title: string;
  message: string;
  type: NotificationType;
  metadata: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

interface NotificationsPageProps {
  userId: string | null;
  onBack: () => void;
}

const TYPE_PRESENTATION: Record<NotificationType, { label: string; icon: LucideIcon; tone: string }> = {
  session_start: { label: "Session", icon: MapPin, tone: "text-sky-600 dark:text-sky-400" },
  checkin: { label: "Check-in", icon: CheckCircle2, tone: "text-emerald-600 dark:text-emerald-400" },
  emergency: { label: "Emergency", icon: ShieldAlert, tone: "text-red-600 dark:text-red-400" },
  session_end: { label: "Session ended", icon: Flag, tone: "text-teal-600 dark:text-teal-400" },
  update: { label: "Update", icon: Clock3, tone: "text-amber-600 dark:text-amber-400" },
  guardian_alert: { label: "Guardian alert", icon: ShieldCheck, tone: "text-orange-600 dark:text-orange-400" },
};

function formatTimestamp(value: string) {
  const date = new Date(value);
  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })} · ${date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

export function NotificationsPage({ userId, onBack }: NotificationsPageProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    try {
      const result = await invokeNotificationApi<{ notifications: NotificationItem[] }>({ action: "list" });
      setNotifications(result.notifications || []);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(getFriendlyErrorMessage(error, "We couldn’t load your activity just now. Please try again."));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    const initialFetchTimer = window.setTimeout(() => void fetchNotifications(), 0);
    if (!userId) return () => window.clearTimeout(initialFetchTimer);

    const channel = supabase
      .channel(`notifications:${userId}`, { config: { private: false } })
      .on("broadcast", { event: "changed" }, (payload) => {
        if (payload.payload?.userId === userId) void fetchNotifications();
      })
      .subscribe();
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") void fetchNotifications();
    }, 30000);
    const refreshOnFocus = () => {
      if (document.visibilityState === "visible") void fetchNotifications();
    };
    document.addEventListener("visibilitychange", refreshOnFocus);
    window.addEventListener("focus", refreshOnFocus);

    return () => {
      window.clearTimeout(initialFetchTimer);
      window.clearInterval(refreshTimer);
      document.removeEventListener("visibilitychange", refreshOnFocus);
      window.removeEventListener("focus", refreshOnFocus);
      void supabase.removeChannel(channel);
    };
  }, [fetchNotifications, userId]);

  const handleReadToggle = async (item: NotificationItem) => {
    const nextValue = !item.is_read;
    setBusyId(item.id);
    setNotifications((current) => current.map((notification) =>
      notification.id === item.id ? { ...notification, is_read: nextValue } : notification
    ));
    try {
      await invokeNotificationApi({ action: "mark_read", id: item.id, isRead: nextValue });
    } catch (error) {
      setNotifications((current) => current.map((notification) =>
        notification.id === item.id ? { ...notification, is_read: item.is_read } : notification
      ));
      setErrorMessage(getFriendlyErrorMessage(error, "We couldn’t update that item. Please try again."));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    const previous = notifications;
    setBusyId(id);
    setNotifications((current) => current.filter((item) => item.id !== id));
    try {
      await invokeNotificationApi({ action: "delete", id });
    } catch (error) {
      setNotifications(previous);
      setErrorMessage(getFriendlyErrorMessage(error, "We couldn’t remove that item. Please try again."));
    } finally {
      setBusyId(null);
    }
  };

  const handleClearAll = async () => {
    if (notifications.length === 0) return;
    const previous = notifications;
    setClearingAll(true);
    setNotifications([]);
    try {
      await invokeNotificationApi({ action: "clear" });
    } catch (error) {
      setNotifications(previous);
      setErrorMessage(getFriendlyErrorMessage(error, "We couldn’t clear your activity. Please try again."));
    } finally {
      setClearingAll(false);
    }
  };

  const unreadCount = notifications.filter((item) => !item.is_read).length;

  return (
    <section className="mx-auto w-full max-w-2xl space-y-5">
      <header className="flex items-center justify-between gap-3 border-b border-zinc-200 pb-3 dark:border-zinc-800">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-sm font-semibold text-zinc-500 transition-colors hover:text-zinc-950 dark:hover:text-white"
          aria-label="Back"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
        <div className="min-w-0 text-center">
          <h2 className="text-base font-extrabold text-zinc-950 dark:text-white">Activity</h2>
          <p className="text-xs text-zinc-500">{unreadCount} unread</p>
        </div>
        {notifications.length > 0 ? (
          <button
            type="button"
            onClick={() => void handleClearAll()}
            disabled={clearingAll}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400"
          >
            {clearingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Clear all
          </button>
        ) : <span className="w-16" />}
      </header>

      {errorMessage && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          <span>{errorMessage}</span>
          <button type="button" onClick={() => void fetchNotifications()} className="font-bold underline underline-offset-2">Try again</button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-500" role="status">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading activity
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <Bell className="h-6 w-6 text-zinc-400" />
          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Nothing to catch up on</p>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {notifications.map((item) => {
            const presentation = TYPE_PRESENTATION[item.type] || TYPE_PRESENTATION.update;
            const Icon = presentation.icon;
            return (
              <li key={item.id} className={`flex gap-3 py-4 ${item.is_read ? "opacity-75" : ""}`}>
                <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-900 ${presentation.tone}`}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h3 className="min-w-0 flex-1 text-sm font-bold text-zinc-950 dark:text-white">{item.title}</h3>
                    {!item.is_read && <span className="h-2 w-2 rounded-full bg-sky-500" aria-label="Unread" />}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                    <span className={`font-bold ${presentation.tone}`}>{presentation.label}</span>
                    <time className="text-zinc-500" dateTime={item.created_at}>{formatTimestamp(item.created_at)}</time>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap wrap-break-word text-sm leading-5 text-zinc-600 dark:text-zinc-300">{item.message}</p>
                  <div className="mt-2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void handleReadToggle(item)}
                      disabled={busyId === item.id}
                      className="inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-950 disabled:opacity-50 dark:hover:bg-zinc-900 dark:hover:text-white"
                      aria-label={item.is_read ? `Mark ${item.title} unread` : `Mark ${item.title} read`}
                    >
                      {item.is_read ? <Mail className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                      {item.is_read ? "Mark unread" : "Mark read"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(item.id)}
                      disabled={busyId === item.id}
                      className="inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50 dark:hover:text-red-400"
                      aria-label={`Delete ${item.title}`}
                    >
                      {busyId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}