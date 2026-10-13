"use client";

import React, { useState, useEffect } from "react";
import { Bell, ShieldAlert, CheckCircle2, Clock, Trash2, ChevronLeft, Loader2, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface NotificationItem {
  id: string;
  user_id?: string | null;
  title: string;
  message: string;
  type: "alert" | "checkin" | "system" | "session";
  created_at: string;
  read?: boolean;
  is_read?: boolean;
}

interface NotificationsPageProps {
  userPhone: string;
  userId: string | null;
  onBack: () => void;
}

export function NotificationsPage({ userPhone, userId, onBack }: NotificationsPageProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);

  useEffect(() => {
    const ownerFilter = userId
      ? `user_phone.eq.${userPhone},user_id.eq.${userId}`
      : `user_phone.eq.${userPhone}`;

    async function fetchNotifications() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("notifications")
          .select("*")
          .or(ownerFilter)
          .order("created_at", { ascending: false });

        if (!error && data) {
          const items = (data as NotificationItem[]).map((item) => {
            const isRead = item.is_read ?? item.read ?? false;
            return { ...item, is_read: isRead, read: isRead };
          });
          setNotifications(items);
        } else if (error) {
          console.error("Failed to load notifications:", error);
          setNotifications([]);
        }
      } catch (err) {
        console.error("Error fetching notifications:", err);
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    }

    queueMicrotask(() => void fetchNotifications());
    const channel = supabase
      .channel(`notification-list:${userId ?? userPhone}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => void fetchNotifications()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, userPhone]);

  const handleMarkRead = async (id: string) => {
    const previous = notifications;
    setNotifications((current) => current.map((item) =>
      item.id === id ? { ...item, is_read: true, read: true } : item
    ));
    const ownerFilter = userId
      ? `user_phone.eq.${userPhone},user_id.eq.${userId}`
      : `user_phone.eq.${userPhone}`;
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id)
      .or(ownerFilter);

    if (error) {
      console.error("Failed to mark notification as read:", error);
      setNotifications(previous);
    }
  };

  const handleDeleteOne = async (id: string) => {
    setDeletingId(id);
    const previous = notifications;
    setNotifications((current) => current.filter((item) => item.id !== id));
    const ownerFilter = userId
      ? `user_phone.eq.${userPhone},user_id.eq.${userId}`
      : `user_phone.eq.${userPhone}`;
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id)
      .or(ownerFilter);

    if (error) {
      console.error("Failed to delete notification:", error);
      setNotifications(previous);
    }
    setDeletingId(null);
  };

  const handleClearAll = async () => {
    if (notifications.length === 0) return;
    setClearingAll(true);
    const previous = notifications;
    setNotifications([]);
    const ownerFilter = userId
      ? `user_phone.eq.${userPhone},user_id.eq.${userId}`
      : `user_phone.eq.${userPhone}`;
    const { error } = await supabase
      .from("notifications")
      .delete()
      .or(ownerFilter);

    if (error) {
      console.error("Failed to clear notifications:", error);
      setNotifications(previous);
    }
    setClearingAll(false);
  };

  return (
    <div className="space-y-4 max-w-md mx-auto font-sans">
      {/* Top Navigation */}
      <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={onBack}
          className="flex items-center space-x-1 text-xs font-bold text-zinc-500 hover:text-black dark:hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <h2 className="text-sm font-black text-black dark:text-white">Alerts &amp; Activity</h2>

        {notifications.length > 0 ? (
          <button
            onClick={handleClearAll}
            disabled={clearingAll}
            className="text-[11px] font-bold text-red-500 hover:text-red-600 flex items-center space-x-1 disabled:opacity-50 transition-colors"
          >
            {clearingAll ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            <span>Clear All</span>
          </button>
        ) : (
          <div className="w-12" />
        )}
      </div>

      {/* Main Notifications List */}
      {loading ? (
        <div className="flex items-center justify-center space-x-2 text-xs text-zinc-400 py-12">
          <Loader2 className="w-4 h-4 animate-spin text-yellow-400" />
          <span>Loading notifications...</span>
        </div>
      ) : notifications.length === 0 ? (
        <div className="p-8 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 text-center space-y-2">
          <Bell className="w-6 h-6 text-zinc-400 mx-auto" />
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            No recent alerts or notifications.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {notifications.map((item) => (
            <div
              key={item.id}
              className={`p-3.5 rounded-2xl border transition-all flex items-start justify-between gap-3 ${
                item.type === "alert"
                  ? "bg-red-500/10 border-red-500/20 text-red-900 dark:text-red-200"
                  : item.type === "checkin"
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-900 dark:text-emerald-200"
                  : "bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100"
              }`}
            >
              <div className="flex items-start space-x-3 min-w-0 flex-1">
                <div className="p-2 rounded-xl bg-white dark:bg-black/40 shrink-0 mt-0.5">
                  {item.type === "alert" ? (
                    <ShieldAlert className="w-4 h-4 text-red-500" />
                  ) : item.type === "checkin" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Clock className="w-4 h-4 text-yellow-500" />
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold truncate">{item.title}</p>
                    <span className="text-[9px] text-zinc-400 font-mono shrink-0">
                      {new Date(item.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-snug">
                    {item.message}
                  </p>
                </div>
              </div>

              {/* Individual Delete Action */}
              <div className="flex items-center shrink-0">
                {!item.is_read && (
                  <button
                    onClick={() => handleMarkRead(item.id)}
                    className="p-1.5 text-zinc-400 hover:text-emerald-500 transition-colors rounded-lg active:scale-90"
                    title="Mark as read"
                    aria-label={`Mark ${item.title} as read`}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => handleDeleteOne(item.id)}
                  disabled={deletingId === item.id}
                  className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors rounded-lg active:scale-90"
                  title="Delete Notification"
                  aria-label={`Delete ${item.title}`}
                >
                  {deletingId === item.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}