"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Home, Shield, Users, Share2, User, Bell } from "lucide-react";
import { useTheme } from "next-themes";
import { supabase } from "@/lib/supabase";
import { cleanPhone } from "@/lib/utils";
import { requestNotificationPermission, type NotificationPermissionResult } from "@/lib/notifications";
import { sendPushTestNotification, subscribeUserToPush } from "@/lib/push-notifications";
import { dispatchAlert, prepareAlertFeedback } from "@/lib/alerts";
import { db } from "@/lib/db";
import { queueOfflineAction } from "@/lib/offline-sync";

import { HomePage } from "@/components/pages/home-page";
import { SessionPage } from "@/components/pages/session-page";
import { ContactsPage, Contact } from "@/components/pages/contacts-page";
import { SharePage } from "@/components/pages/share-page";
import { ProfilePage } from "@/components/pages/profile-page";
import { NotificationsPage } from "@/components/pages/notifications-page";
import { SplashScreen } from "@/components/splash-screen";

interface MainAppProps {
  userPhone: string;
  onLogout: () => void;
}

interface ActiveSession {
  id: string;
  user_id?: string;
  destination: string;
  expected_arrival_at: string;
  status: "active" | "completed" | "missed" | "escalated";
  user_reminder_mins?: number;
  contact_reminder_mins?: number;
  last_user_checkin_at?: string;
  notes?: string | null;
  current_lat?: number | null;
  current_lng?: number | null;
}

interface ReceivedSession {
  id: string;
  user_phone: string;
  destination: string;
  expected_arrival_at: string;
  status: "active" | "completed" | "missed" | "escalated";
  friendName: string;
  avatarUrl?: string;
}

const BANNERS = [
  {
    id: 1,
    tag: "⚡ RADAR ACTIVE",
    title: "Instant Guardian Radar 🚀",
    desc: "Lock in your route and notify your squad in real-time!",
    image: "/banner/banner1.png",
  },
  {
    id: 2,
    tag: "🌙 NIGHT WATCH",
    title: "Walking Late Tonight? 📱",
    desc: "Set your safety countdown before heading out!",
    image: "/banner/banner2.png",
  },
  {
    id: 3,
    tag: "🔒 PRIVACY FIRST",
    title: "100% Protected 🛡️",
    desc: "Zero background tracking until you activate check-in!",
    image: "/banner/banner3.png",
  },
];

export function MainApp({ userPhone, onLogout }: MainAppProps) {
  const [activeTab, setActiveTab] = useState<"home" | "session" | "contacts" | "share" | "profile" | "notifications">("home");
  const [nickname, setNickname] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [receivedSessions, setReceivedSessions] = useState<ReceivedSession[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  const [destination, setDestination] = useState("");
  const [durationMinutes, setDurationMinutes] = useState<number | "">(30);
  const [userReminderMins, setUserReminderMins] = useState<number | "">(15);
  const [contactReminderMins, setContactReminderMins] = useState<number | "">(30);
  const [notes, setNotes] = useState("");
  const [sessionLoading, setSessionLoading] = useState(false);

  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [addingContact, setAddingContact] = useState(false);

  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "requesting" | "granted" | "low-accuracy" | "denied">("idle");
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");

  const [dataLoading, setDataLoading] = useState(false);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [requestedSharedSessionId, setRequestedSharedSessionId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const { theme, resolvedTheme } = useTheme();

  const notificationPermissionRequestRef = useRef<Promise<NotificationPermissionResult> | null>(null);
  const overdueAlertSentRef = useRef<string | null>(null);

  const ensureNotificationPermission = useCallback(async (): Promise<NotificationPermissionResult> => {
    if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
    if (notificationPermissionRequestRef.current) return notificationPermissionRequestRef.current;

    const permissionRequest = (async () => {
      try {
        const permission = Notification.permission === "default"
          ? await requestNotificationPermission()
          : Notification.permission;
        if (permission !== "unsupported") setNotificationPermission(permission);
        if (permission === "granted" && userId) {
          const subscription = await subscribeUserToPush(userId);
          if (!subscription.ok) console.warn("Push subscription was not registered:", subscription.reason);
        }
        return permission;
      } catch (err: unknown) {
        console.error("Notification prompt error:", err);
        return Notification.permission;
      } finally {
        notificationPermissionRequestRef.current = null;
      }
    })();
    notificationPermissionRequestRef.current = permissionRequest;
    return permissionRequest;
  }, [userId]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setMounted(true);
      if ("Notification" in window) setNotificationPermission(Notification.permission);
    });
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(async ({ data: sessionData, error: sessionError }) => {
      if (cancelled) return;
      if (sessionError || !sessionData.session) {
        localStorage.removeItem("loci_user_phone");
        onLogout();
        return;
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!cancelled && (userError || !userData.user)) {
        localStorage.removeItem("loci_user_phone");
        onLogout();
      }
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        localStorage.removeItem("loci_user_phone");
        onLogout();
      }
    });
    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, [onLogout]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error("Failed to sign out:", error);
    onLogout();
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedTab = params.get("tab");
    const allowedTabs = ["home", "session", "contacts", "share", "profile", "notifications"] as const;
    const validTab = allowedTabs.includes(requestedTab as typeof allowedTabs[number])
      ? requestedTab as typeof allowedTabs[number]
      : null;
    const sharedSessionId = params.get("sharedSessionId");
    const frameId = window.requestAnimationFrame(() => {
      if (validTab) setActiveTab(validTab);
      if (sharedSessionId) {
        setRequestedSharedSessionId(sharedSessionId);
        setActiveTab("contacts");
      }
    });
    if (requestedTab || sharedSessionId) window.history.replaceState({}, "", window.location.pathname);
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const triggerNotificationPrompt = async () => {
    await ensureNotificationPermission();
  };

  const handleTestPush = async () => {
    if (!userId) return "Your profile is still loading. Please try again in a moment.";
    const result = await sendPushTestNotification(userId);
    return result.ok
      ? `A test notification was sent to ${result.data?.delivered ?? 0} device${result.data?.delivered === 1 ? "" : "s"}.`
      : result.reason || "We couldn’t send a test notification just now. Please try again.";
  };

  const triggerLocationPrompt = () => {
    if (typeof window === "undefined") return;
    if (!("geolocation" in navigator)) {
      setLocationStatus("denied");
      return;
    }

    setLocationCoords(null);
    setLocationStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationStatus(pos.coords.accuracy > 500 ? "low-accuracy" : "granted");
      },
      (err) => {
        console.warn("Location permission error:", err);
        setLocationStatus("denied");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 }
    );
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % BANNERS.length);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  const loadUserData = useCallback(async () => {
    const scopedPhone = cleanPhone(userPhone);
    setDataLoading(navigator.onLine);
    try {
      const [cachedUser, cachedContacts, cachedSessions] = await Promise.all([
        db.users.where("phone").equals(scopedPhone).first(),
        db.trusted_contacts.where("user_phone").equals(scopedPhone).toArray(),
        db.checkin_sessions.toArray(),
      ]);
      const scopedSessions = cachedSessions.filter((session) =>
        cleanPhone(session.scope_phone || session.user_phone || "") === scopedPhone
      );
      if (cachedUser) {
        setUserId(cachedUser.id);
        setFullName(cachedUser.full_name || "");
        setNickname(cachedUser.nickname || "");
        setAvatarUrl(cachedUser.avatar_url || "");
      }
      if (cachedContacts.length > 0) {
        setContacts(cachedContacts);
        setSelectedContactIds(cachedContacts.map((contact) => contact.id));
      }
      const cachedActiveSession = scopedSessions
        .filter((session) => session.status === "active" || session.status === "escalated")
        .sort((left, right) => (right.created_at || "").localeCompare(left.created_at || ""))[0];
      if (cachedActiveSession) {
        setActiveSession(cachedActiveSession as ActiveSession);
        localStorage.setItem("loci_active_session", JSON.stringify(cachedActiveSession));
      }
      const hasCachedAppData = !!cachedUser || cachedContacts.length > 0 || !!cachedActiveSession;
      if (hasCachedAppData) setDataLoading(false);
      if (!navigator.onLine) return;

      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id, full_name, nickname, avatar_url")
        .eq("phone", scopedPhone)
        .maybeSingle();

      if (!userError) {
        if (userData) {
          setUserId(userData.id);
          setFullName(userData.full_name || "");
          setNickname(userData.nickname || "");
          setAvatarUrl(userData.avatar_url || "");
          await db.users.put({ ...cachedUser, ...userData, phone: scopedPhone, cached_at: new Date().toISOString() });
        } else {
          setUserId(null);
        }
      }

      const { data: contactsData, error: contactsError } = await supabase
        .from("trusted_contacts")
        .select("id, name, phone, group_category")
        .eq("user_phone", scopedPhone)
        .order("created_at", { ascending: false });

      if (!contactsError && contactsData) {
        const phoneNumbers = Array.from(new Set(contactsData.flatMap((contact) => [
          contact.phone,
          cleanPhone(contact.phone),
        ]).filter(Boolean)));
        const { data: matchedUsers } = await supabase
          .from("users")
          .select("id, phone, avatar_url")
          .in("phone", phoneNumbers);

        const matchedUserMap = new Map(
          (matchedUsers || []).map((user) => [cleanPhone(user.phone), user])
        );

        const formattedContacts: Contact[] = contactsData.map((contact) => {
          const matchedUser = matchedUserMap.get(cleanPhone(contact.phone));
          return {
            ...contact,
            user_phone: scopedPhone,
            contact_user_id: matchedUser?.id,
            isLociUser: !!matchedUser,
            avatar_url: matchedUser?.avatar_url || undefined,
          };
        });

        setContacts(formattedContacts);
        setSelectedContactIds(formattedContacts.map((c) => c.id));
        await db.trusted_contacts.where("user_phone").equals(scopedPhone).delete();
        if (formattedContacts.length > 0) await db.trusted_contacts.bulkPut(formattedContacts);
        if (matchedUsers?.length) {
          await db.users.bulkPut(matchedUsers.map((user) => ({
            ...((cachedUser?.id === user.id) ? cachedUser : {}),
            id: user.id,
            phone: cleanPhone(user.phone),
            avatar_url: user.avatar_url,
            cached_at: new Date().toISOString(),
          })));
        }
      }

      const { data: activeSessionRows, error: sessionsError } = await supabase
        .from("checkin_sessions")
        .select("*")
        .in("status", ["active", "escalated"])
        .order("created_at", { ascending: false });

      if (sessionsError) throw sessionsError;
      const sessionData = activeSessionRows?.find((session) =>
        cleanPhone(session.user_phone) === cleanPhone(userPhone)
      );

      if (sessionData) {
        const scopedSession = { ...sessionData, scope_phone: scopedPhone };
        setActiveSession(scopedSession);
        if (typeof window !== "undefined") {
          localStorage.setItem("loci_active_session", JSON.stringify(scopedSession));
        }
        await db.checkin_sessions.put(scopedSession);
      } else if (typeof window !== "undefined") {
        await db.checkin_sessions.where("scope_phone").equals(scopedPhone)
          .filter((session) => (session.status === "active" || session.status === "escalated")
            && !session.id.startsWith("local-") && !session.server_id)
          .delete();
        const pendingCachedSession = await db.checkin_sessions.toArray().then((sessions) => sessions.find((session) =>
          session.scope_phone === scopedPhone
          && (session.status === "active" || session.status === "escalated")
          && (session.id.startsWith("local-") || !!session.server_id)
        ));
        const cached = localStorage.getItem("loci_active_session");
        if (pendingCachedSession) {
          setActiveSession(pendingCachedSession as ActiveSession);
          localStorage.setItem("loci_active_session", JSON.stringify(pendingCachedSession));
        } else
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if ((parsed.status === "active" || parsed.status === "escalated")
              && cleanPhone(parsed.scope_phone || parsed.user_phone || "") === scopedPhone) {
              setActiveSession(parsed);
            }
          } catch {
            localStorage.removeItem("loci_active_session");
          }
        }
      }
    } catch (err) {
      console.error("Failed to load user data:", err);
    } finally {
      setDataLoading(false);
    }
  }, [userPhone]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => void loadUserData());
    return () => window.cancelAnimationFrame(frameId);
  }, [loadUserData]);

  const fetchUnreadNotificationCount = useCallback(async () => {
    if (!userId) {
      setUnreadNotificationCount(0);
      return;
    }
    const cachedNotifications = await db.notifications.where("user_id").equals(userId).toArray();
    if (cachedNotifications.length > 0) {
      setUnreadNotificationCount(cachedNotifications.filter((notification) => !notification.is_read).length);
    }
    if (!navigator.onLine) return;
    try {
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false);
      if (error) throw error;
      setUnreadNotificationCount(count ?? 0);
    } catch (error) {
      console.warn("Could not refresh notifications right now:", error);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const countTimer = window.setTimeout(() => void fetchUnreadNotificationCount(), 0);

    const channel = supabase
      .channel(`notifications:${userId}`, { config: { private: false } })
      .on("broadcast", { event: "changed" }, (payload) => {
        if (payload.payload?.userId === userId) void fetchUnreadNotificationCount();
      })
      .subscribe();

    return () => {
      window.clearTimeout(countTimer);
      void supabase.removeChannel(channel);
    };
  }, [fetchUnreadNotificationCount, userId]);

  const fetchReceivedSessions = useCallback(async () => {
    const scopedPhone = cleanPhone(userPhone);
    const cachedSessions = await db.checkin_sessions.toArray();
    const cachedRecipients = await db.session_recipients.where("scope_phone").equals(scopedPhone).toArray();
    const cachedRecipientIds = new Set(cachedRecipients.map((recipient) => recipient.session_id));
    const cachedReceived = cachedSessions.filter((session) =>
      (session.status === "active" || session.status === "escalated")
      && cleanPhone(session.user_phone || "") !== scopedPhone
      && (cachedRecipientIds.has(session.id)
        || contacts.some((contact) => cleanPhone(contact.phone) === cleanPhone(session.user_phone || "")))
    );
    if (cachedReceived.length > 0) {
      setReceivedSessions(cachedReceived.map((session) => ({
        id: session.id,
        user_phone: session.user_phone || "",
        destination: session.destination,
        expected_arrival_at: session.expected_arrival_at,
        status: session.status as ReceivedSession["status"],
        friendName: contacts.find((contact) => cleanPhone(contact.phone) === cleanPhone(session.user_phone || ""))?.name || "Circle Friend",
      })));
    }
    if (!navigator.onLine) return;

    const contactPhones = new Set(contacts
      .map((contact) => cleanPhone(contact.phone))
      .filter((phone) => phone && phone !== cleanPhone(userPhone)));

    const [{ data: sessions, error }, { data: recipients, error: recipientError }] = await Promise.all([
      supabase
        .from("checkin_sessions")
        .select("id, user_phone, destination, expected_arrival_at, status")
        .eq("status", "active")
        .order("created_at", { ascending: false }),
      supabase
        .from("session_recipients")
        .select("session_id, recipient_phone, contact_phone"),
    ]);

    if (error || !sessions) {
      console.error("Failed to load received sessions:", error);
      return;
    }
    if (recipientError) console.error("Failed to load received session recipients:", recipientError);

    const currentPhone = cleanPhone(userPhone);
    const recipientSessionIds = new Set((recipients || [])
      .filter((recipient) =>
        cleanPhone(recipient.recipient_phone) === currentPhone ||
        cleanPhone(recipient.contact_phone) === currentPhone
      )
      .map((recipient) => recipient.session_id));

    const receivedSessions = sessions.filter((session) => {
      const ownerPhone = cleanPhone(session.user_phone);
      return ownerPhone !== currentPhone && (contactPhones.has(ownerPhone) || recipientSessionIds.has(session.id));
    });

    await db.transaction("rw", db.checkin_sessions, db.session_recipients, async () => {
      const serverSessionIds = new Set(receivedSessions.map((session) => session.id));
      const existingCached = await db.checkin_sessions.toArray();
      const stale = existingCached.filter((session) =>
        session.scope_phone === currentPhone
        && session.user_phone !== currentPhone
        && !serverSessionIds.has(session.id)
      );
      if (stale.length) await db.checkin_sessions.bulkDelete(stale.map((session) => session.id));
      await db.checkin_sessions.bulkPut(receivedSessions.map((session) => ({
        ...session,
        scope_phone: currentPhone,
      })));
      await db.session_recipients.where("scope_phone").equals(currentPhone).delete();
      await db.session_recipients.bulkPut((recipients || [])
        .filter((recipient) => cleanPhone(recipient.recipient_phone) === currentPhone
          || cleanPhone(recipient.contact_phone) === currentPhone)
        .map((recipient, index) => ({ ...recipient, id: `${recipient.session_id}:${index}`, scope_phone: currentPhone })));
    });

    const senderPhones = Array.from(new Set(receivedSessions.map((session) => session.user_phone)));
    const { data: users } = await supabase
      .from("users")
      .select("phone, nickname, full_name, avatar_url")
      .in("phone", senderPhones);

    setReceivedSessions(
      receivedSessions.map((session) => {
        const contact = contacts.find((item) => cleanPhone(item.phone) === cleanPhone(session.user_phone));
        const user = users?.find((item) => cleanPhone(item.phone) === cleanPhone(session.user_phone));
        return {
          ...session,
          friendName: user?.nickname || user?.full_name || contact?.name || "Circle Friend",
          avatarUrl: user?.avatar_url || undefined,
        };
      })
    );
    await db.users.bulkPut((users || []).map((user) => ({
      id: `cached-${cleanPhone(user.phone)}`,
      phone: cleanPhone(user.phone),
      nickname: user.nickname,
      full_name: user.full_name,
      avatar_url: user.avatar_url,
      cached_at: new Date().toISOString(),
    })));
  }, [contacts, userPhone]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchReceivedSessions();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchReceivedSessions]);

  useEffect(() => {
    const refreshOnline = () => {
      void loadUserData();
      void fetchReceivedSessions();
      void fetchUnreadNotificationCount();
    };
    window.addEventListener("online", refreshOnline);
    return () => window.removeEventListener("online", refreshOnline);
  }, [fetchReceivedSessions, fetchUnreadNotificationCount, loadUserData]);

  useEffect(() => {
    const contactPhones = new Set(contacts
      .map((contact) => cleanPhone(contact.phone))
      .filter((phone) => phone && phone !== cleanPhone(userPhone)));

    const channel = supabase
      .channel("global_realtime_sessions")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "checkin_sessions",
        },
        (payload) => {
          const newSession = payload.new as Partial<ReceivedSession>;
          const oldSession = payload.old as Partial<ReceivedSession>;
          const changedSession = newSession.user_phone ? newSession : oldSession;
          if (changedSession.user_phone && contactPhones.has(cleanPhone(changedSession.user_phone))) {
            void fetchReceivedSessions();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [contacts, fetchReceivedSessions, userPhone]);

  useEffect(() => {
    if (!activeSession) return;

    const titleInterval = setInterval(() => {
      if (typeof document !== "undefined") {
        document.title = "🛡️ Active Walk Session — Déloci";
      }
    }, 2000);

    return () => {
      clearInterval(titleInterval);
      if (typeof document !== "undefined") {
        document.title = "Déloci — Personal Safety";
      }
    };
  }, [activeSession]);

  useEffect(() => {
    if (!activeSession || activeSession.status !== "active") return;

    const checkOverdueAlert = () => {
      const now = Date.now();
      const expectedTime = new Date(activeSession.expected_arrival_at).getTime();

      if (now > expectedTime && overdueAlertSentRef.current !== activeSession.id) {
        overdueAlertSentRef.current = activeSession.id;
        void dispatchAlert({
          userIds: contacts.map((contact) => contact.contact_user_id || contact.phone),
          title: "Urgent: Missed Check-In Alert",
          message: `${nickname || fullName || "Your friend"} was expected at ${activeSession.destination} and has not checked in.`,
          type: "guardian_alert",
          url: "/main?tab=contacts",
          sessionId: activeSession.id,
          metadata: { destination: activeSession.destination },
          playFeedback: false,
          showLocal: false,
        });
      }
    };

    checkOverdueAlert();
    const checkWhenVisible = () => {
      if (document.visibilityState === "visible") checkOverdueAlert();
    };
    const overdueInterval = setInterval(checkOverdueAlert, 10000);
    document.addEventListener("visibilitychange", checkWhenVisible);
    window.addEventListener("focus", checkOverdueAlert);
    return () => {
      clearInterval(overdueInterval);
      document.removeEventListener("visibilitychange", checkWhenVisible);
      window.removeEventListener("focus", checkOverdueAlert);
    };
  }, [activeSession, contacts, fullName, nickname]);

  const toggleContactSelection = (id: string) => {
    setSelectedContactIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleStartSession = async (
    e: React.FormEvent,
    coordinates?: { latitude: number; longitude: number }
  ): Promise<boolean> => {
    e.preventDefault();
    void prepareAlertFeedback();
    const finalMins = Number(durationMinutes) || 30;
    const destName = destination.trim() || "Destination Check-In";

    const arrivalTime = new Date(Date.now() + finalMins * 60000).toISOString();
    const tempSession: ActiveSession = {
      id: `local-${Date.now()}`,
      destination: destName,
      expected_arrival_at: arrivalTime,
      status: "active",
      user_reminder_mins: Number(userReminderMins) || 15,
      contact_reminder_mins: Number(contactReminderMins) || 30,
      last_user_checkin_at: new Date().toISOString(),
      current_lat: coordinates?.latitude ?? null,
      current_lng: coordinates?.longitude ?? null,
    };

    setActiveSession(tempSession);
    if (typeof window !== "undefined") {
      localStorage.setItem("loci_active_session", JSON.stringify(tempSession));
    }
    setActiveTab("session");
    setSessionLoading(true);

    const selectedContacts = contacts.filter((contact) => selectedContactIds.includes(contact.id));

    try {
      const scopedSession = {
        ...tempSession,
        user_id: userId || undefined,
        user_phone: cleanPhone(userPhone),
        scope_phone: cleanPhone(userPhone),
        notes: notes.trim() || null,
        created_at: new Date().toISOString(),
      };
      await db.checkin_sessions.put(scopedSession);

      if (!navigator.onLine) {
        await queueOfflineAction("start_session", {
          session: scopedSession,
          recipients: selectedContacts.map((contact) => ({
            contact_phone: contact.phone,
            recipient_phone: contact.phone,
          })),
        }, tempSession.id);
        if (selectedContacts.length > 0) {
          await queueOfflineAction("send_alert", {
            userIds: selectedContacts.map((contact) => contact.contact_user_id || contact.phone),
            title: "Safety Session Shared",
            message: `A safety session heading to ${destName} has been shared with you.`,
            type: "session_start",
            url: "/main?tab=contacts",
            sessionId: tempSession.id,
            metadata: { destination: destName },
          }, tempSession.id);
        }
        return true;
      }

      const { data, error } = await supabase
        .from("checkin_sessions")
        .insert({
          client_mutation_id: tempSession.id,
          user_id: userId,
          user_phone: userPhone,
          destination: destName,
          expected_arrival_at: arrivalTime,
          status: "active",
          user_reminder_mins: Number(userReminderMins) || 15,
          contact_reminder_mins: Number(contactReminderMins) || 30,
          last_user_checkin_at: new Date().toISOString(),
          notes: notes.trim() || null,
          current_lat: coordinates?.latitude ?? null,
          current_lng: coordinates?.longitude ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error("Session could not be saved.");

      if (!error && data) {
        const persistedSession = { ...data, scope_phone: cleanPhone(userPhone) };
        setActiveSession(persistedSession);
        await db.checkin_sessions.put(persistedSession);
        await db.checkin_sessions.delete(tempSession.id);
        if (userId) {
          void dispatchAlert({
            userIds: userId,
            title: "Session Started",
            message: `Your safety watch session to ${destName} is active.`,
            type: "session_start",
            sessionId: data.id,
            playFeedback: false,
            showLocal: false,
          });
        }
        if (selectedContacts.length > 0) {
          void dispatchAlert({
            userIds: selectedContacts.map((contact) => contact.contact_user_id || contact.phone),
            title: "Safety Session Shared",
            message: `A safety session heading to ${destName} has been shared with you.`,
            type: "session_start",
            url: "/main?tab=contacts",
            sessionId: data.id,
            metadata: { destination: destName },
            playFeedback: false,
            showLocal: false,
          });
          const { error: recipientsError } = await supabase
            .from("session_recipients")
            .insert(selectedContacts.map((contact) => ({
              session_id: data.id,
              contact_phone: contact.phone,
              recipient_phone: contact.phone,
            })));
          if (recipientsError) {
            console.error("Failed to save session guardians:", recipientsError);
            await queueOfflineAction("start_session", {
              session: scopedSession,
              serverSessionId: data.id,
              recipients: selectedContacts.map((contact) => ({
                contact_phone: contact.phone,
                recipient_phone: contact.phone,
              })),
            }, tempSession.id);
            await db.checkin_sessions.update(tempSession.id, { server_id: data.id });
          }
        }
        if (typeof window !== "undefined") {
          localStorage.setItem("loci_active_session", JSON.stringify(data));
        }
      }
    } catch (err) {
      console.error("Session creation failed:", err);
      const scopedSession = {
        ...tempSession,
        user_id: userId || undefined,
        user_phone: cleanPhone(userPhone),
        scope_phone: cleanPhone(userPhone),
        notes: notes.trim() || null,
        created_at: new Date().toISOString(),
      };
      await db.checkin_sessions.put(scopedSession);
      await queueOfflineAction("start_session", {
        session: scopedSession,
        recipients: selectedContacts.map((contact) => ({
          contact_phone: contact.phone,
          recipient_phone: contact.phone,
        })),
      }, tempSession.id);
      if (selectedContacts.length > 0) {
        await queueOfflineAction("send_alert", {
          userIds: selectedContacts.map((contact) => contact.contact_user_id || contact.phone),
          title: "Safety Session Shared",
          message: `A safety session heading to ${destName} has been shared with you.`,
          type: "session_start",
          url: "/main?tab=contacts",
          sessionId: tempSession.id,
          metadata: { destination: destName },
        }, tempSession.id);
      }
      return true;
    } finally {
      setSessionLoading(false);
      setDestination("");
      setNotes("");
    }
    return true;
  };

  const handleSafeCheckin = async (): Promise<boolean> => {
    if (!activeSession) return false;
    const checkedInAt = new Date().toISOString();

    if (!navigator.onLine || activeSession.id.startsWith("local-")) {
      await queueOfflineAction("safe_checkin", { sessionId: activeSession.id, timestamp: checkedInAt }, activeSession.id);
    } else {
      try {
        const { error } = await supabase
          .from("checkin_sessions")
          .update({ last_user_checkin_at: checkedInAt })
          .eq("id", activeSession.id)
          .eq("status", "active");
        if (error) throw error;
      } catch (error) {
        console.error("Failed to record safety check-in:", error);
        await queueOfflineAction("safe_checkin", { sessionId: activeSession.id, timestamp: checkedInAt }, activeSession.id);
      }
    }

    const updatedSession = { ...activeSession, last_user_checkin_at: checkedInAt };
    setActiveSession(updatedSession);
    if (typeof window !== "undefined") {
      localStorage.setItem("loci_active_session", JSON.stringify(updatedSession));
    }
    await db.checkin_sessions.put({ ...updatedSession, scope_phone: cleanPhone(userPhone) });
    return true;
  };

  const handleSosTriggered = (
    sessionId: string | undefined,
    coordinates: { latitude: number; longitude: number } | null
  ) => {
    setActiveSession((current) => {
      if (!current) return current;
      const updatedSession = {
        ...current,
        id: sessionId || current.id,
        status: "escalated" as const,
        current_lat: coordinates?.latitude ?? null,
        current_lng: coordinates?.longitude ?? null,
      };
      if (typeof window !== "undefined") {
        localStorage.setItem("loci_active_session", JSON.stringify(updatedSession));
      }
      void db.checkin_sessions.put({ ...updatedSession, scope_phone: cleanPhone(userPhone) });
      return updatedSession;
    });
  };

  const handleCompleteSession = async (): Promise<boolean> => {
    const sessionToComplete = activeSession;
    const currentId = sessionToComplete?.id;
    if (!currentId) return false;

    if (!navigator.onLine || currentId.startsWith("local-")) {
      await queueOfflineAction("complete_session", { sessionId: currentId }, currentId);
      await db.checkin_sessions.update(currentId, { status: "completed" });
      setActiveSession(null);
      localStorage.removeItem("loci_active_session");
      return true;
    }

    setActiveSession(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("loci_active_session");
    }

    if (currentId && !currentId.startsWith("local-")) {
      setSessionLoading(true);
      try {
        const { error } = await supabase
          .from("checkin_sessions")
          .update({ status: "completed" })
          .eq("id", currentId);
        if (error) throw error;
        await db.checkin_sessions.delete(currentId);
      } catch (error) {
        console.error("Failed to end safety session:", error);
        await queueOfflineAction("complete_session", { sessionId: currentId }, currentId);
        await db.checkin_sessions.update(currentId, { status: "completed" });
        setActiveSession(null);
        if (typeof window !== "undefined") localStorage.removeItem("loci_active_session");
        return true;
      } finally {
        setSessionLoading(false);
      }
    }
    return true;
  };

  const handleAddManualContact = async (
    selectedGroup?: string | null,
    pendingContact?: { name: string; phone: string }
  ): Promise<boolean> => {
    const contactName = pendingContact?.name.trim() || manualName.trim();
    const contactPhone = (pendingContact?.phone || manualPhone).replace(/[\s\-\(\)]/g, "");
    const groupCategory = selectedGroup?.trim() || null;
    if (!contactName || !/^\+\d{7,15}$/.test(contactPhone)) return false;

    const localContact = {
      id: `local-contact-${Date.now()}`,
      user_phone: cleanPhone(userPhone),
      name: contactName,
      phone: contactPhone,
      group_category: groupCategory,
    };

    if (!navigator.onLine) {
      await db.trusted_contacts.put(localContact);
      await queueOfflineAction("add_contact", { contact: localContact }, localContact.id);
      setContacts((prev) => [localContact, ...prev]);
      setSelectedContactIds((prev) => [...prev, localContact.id]);
      setManualName("");
      setManualPhone("");
      return true;
    }

    setAddingContact(true);
    try {
      const { data, error } = await supabase
        .from("trusted_contacts")
        .insert({
          user_phone: userPhone,
          name: contactName,
          phone: contactPhone,
          group_category: groupCategory,
        })
        .select()
        .single();
      if (error) throw error;

      const { data: matchedUser } = await supabase
        .from("users")
        .select("phone, avatar_url")
        .eq("phone", contactPhone)
        .maybeSingle();
      const newContact: Contact = {
        ...data,
        user_phone: cleanPhone(userPhone),
        isLociUser: !!matchedUser,
        avatar_url: matchedUser?.avatar_url || undefined,
      };
      await db.trusted_contacts.put(newContact);
      setContacts((prev) => [newContact, ...prev]);
      setSelectedContactIds((prev) => [...prev, newContact.id]);
      setManualName("");
      setManualPhone("");
      return true;
    } catch (error) {
      console.error("Failed to add guardian contact:", error);
      await db.trusted_contacts.put(localContact);
      await queueOfflineAction("add_contact", { contact: localContact }, localContact.id);
      setContacts((prev) => [localContact, ...prev]);
      setSelectedContactIds((prev) => [...prev, localContact.id]);
      setManualName("");
      setManualPhone("");
      return true;
    } finally {
      setAddingContact(false);
    }
  };

  const handleDeleteContact = async (id: string) => {
    const removeLocally = async () => {
      await db.trusted_contacts.delete(id);
      setContacts((prev) => prev.filter((c) => c.id !== id));
      setSelectedContactIds((prev) => prev.filter((cId) => cId !== id));
    };
    if (id.startsWith("local-contact-")) {
      const queuedAdd = await db.offline_queue
        .where("action_type")
        .equals("add_contact")
        .filter((item) => item.entity_id === id)
        .first();
      if (queuedAdd?.id !== undefined) {
        await db.offline_queue.delete(queuedAdd.id);
        await removeLocally();
        return;
      }
    }
    if (!navigator.onLine) {
      await queueOfflineAction("delete_contact", { id }, id);
      await removeLocally();
      return;
    }
    const { error } = await supabase.from("trusted_contacts").delete().eq("id", id);
    if (!error) {
      await removeLocally();
    } else {
      await queueOfflineAction("delete_contact", { id }, id);
      await removeLocally();
    }
  };

  const isDark = mounted && (theme === "dark" || resolvedTheme === "dark");
  const sessionHeadingSrc = isDark ? "/session-dark.png" : "/session-light.png";

  if (!mounted) return <SplashScreen />;

  return (
    <div suppressHydrationWarning className="min-h-screen bg-zinc-100/60 dark:bg-black text-zinc-900 dark:text-zinc-100 flex flex-col justify-between max-w-md mx-auto w-full font-sans antialiased relative border-x border-zinc-200/50 dark:border-zinc-900 selection:bg-yellow-400 selection:text-black">
      {activeTab !== "session" && (
        <header className="sticky top-0 z-50 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2.5 bg-white/70 dark:bg-black/70 backdrop-blur-3xl border-b border-zinc-200/40 dark:border-zinc-800/40 grid grid-cols-3 items-center">
          <div className="text-left truncate leading-none">
            <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 block mb-0.5">
              Welcome,
            </span>
            <span className="text-sm font-extrabold text-black dark:text-white truncate block">
              {dataLoading ? "..." : `${nickname || "Guardian"} 👋`}
            </span>
          </div>

          <div className="flex justify-center items-center">
            <img src="/loci-light.png" alt="Déloci Logo" className="h-10 w-auto object-contain shrink-0 dark:hidden" />
            <img src="/loci-dark.png" alt="Déloci Logo" className="hidden h-10 w-auto object-contain shrink-0 dark:block" />
          </div>

          <div className="flex justify-end items-center space-x-1.5">
            <button
              onClick={() => setActiveTab("notifications")}
              className={`p-2 rounded-full transition-all active:scale-90 border ${
                activeTab === "notifications"
                  ? "border-yellow-400 bg-yellow-400/10 text-yellow-500"
                  : "border-transparent text-zinc-400 hover:text-black dark:hover:text-white"
              } relative`}
              title="Alerts & Notifications"
              aria-label={`Alerts & Notifications${unreadNotificationCount > 0 ? `, ${unreadNotificationCount} unread` : ""}`}
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold leading-4 text-center">
                  {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("profile")}
              className={`p-0.5 rounded-full transition-all active:scale-90 border ${
                activeTab === "profile"
                  ? "border-yellow-400 p-1"
                  : "border-transparent"
              }`}
              title="Profile & Settings"
            >
              <div className="w-7 h-7 rounded-full overflow-hidden bg-zinc-900 text-yellow-400 font-extrabold text-xs flex items-center justify-center uppercase border border-yellow-400/40">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="User Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-4 h-4 text-zinc-400" />
                )}
              </div>
            </button>
          </div>
        </header>
      )}

      <main className="flex-1 px-4 py-5 space-y-5 pb-28">
        {dataLoading ? (
          <div className="space-y-5 animate-pulse">
            <div className="h-36 bg-zinc-200/80 dark:bg-zinc-900/80 rounded-[26px] w-full" />
            <div className="space-y-2.5">
              <div className="h-4 w-40 bg-zinc-200/80 dark:bg-zinc-900/80 rounded-md" />
              <div className="flex items-center space-x-3 overflow-x-hidden pt-1">
                <div className="w-12 h-12 rounded-full bg-zinc-200/80 dark:bg-zinc-900/80 shrink-0" />
                <div className="w-12 h-12 rounded-full bg-zinc-200/80 dark:bg-zinc-900/80 shrink-0" />
                <div className="w-12 h-12 rounded-full bg-zinc-200/80 dark:bg-zinc-900/80 shrink-0" />
              </div>
            </div>
            <div className="h-28 bg-zinc-200/80 dark:bg-zinc-900/80 rounded-[26px] w-full" />
          </div>
        ) : (
          <>
            {activeTab === "home" && (
              <HomePage
                activeSession={activeSession}
                contacts={contacts}
                currentUserPhone={userPhone}
                onViewLiveFeed={(sessionId) => {
                  setRequestedSharedSessionId(sessionId);
                  setActiveTab("contacts");
                }}
                receivedSessions={receivedSessions}
                currentBanner={currentBanner}
                setCurrentBanner={setCurrentBanner}
                banners={BANNERS}
                contactsSupported={true}
                handlePickDeviceContact={() => setActiveTab("contacts")}
                handleCompleteSession={handleCompleteSession}
                handleSafeCheckin={handleSafeCheckin}
                onNavigate={setActiveTab}
              />
            )}

            {activeTab === "session" && (
              <SessionPage
                activeSession={activeSession}
                contactReminderMins={contactReminderMins}
                contacts={contacts}
                destination={destination}
                handleCompleteSession={handleCompleteSession}
                handleSafeCheckin={handleSafeCheckin}
                handleStartSession={handleStartSession}
                onSosTriggered={handleSosTriggered}
                notes={notes}
                onNavigate={setActiveTab}
                selectedContactIds={selectedContactIds}
                sessionHeadingSrc={sessionHeadingSrc}
                sessionLoading={sessionLoading}
                setContactReminderMins={setContactReminderMins}
                setDestination={setDestination}
                setDurationMinutes={setDurationMinutes}
                setNotes={setNotes}
                setUserReminderMins={setUserReminderMins}
                toggleContactSelection={toggleContactSelection}
                userId={userId}
                userReminderMins={userReminderMins}
              />
            )}

            {activeTab === "contacts" && (
              <ContactsPage
                currentUserId={userId}
                openSessionId={requestedSharedSessionId}
                onSessionOpened={() => setRequestedSharedSessionId(null)}
                userPhone={userPhone}
                contacts={contacts}
                addingContact={addingContact}
                manualName={manualName}
                setManualName={setManualName}
                manualPhone={manualPhone}
                setManualPhone={setManualPhone}
                handleAddManualContact={handleAddManualContact}
                handleDeleteContact={handleDeleteContact}
              />
            )}

            {activeTab === "share" && (
              <SharePage nickname={nickname} userPhone={userPhone} />
            )}

            {activeTab === "profile" && (
              <ProfilePage
                avatarUrl={avatarUrl}
                fullName={fullName}
                nickname={nickname}
                onAvatarChange={(url) => setAvatarUrl(url)}
                userId={userId}
                userPhone={userPhone}
                notificationPermission={notificationPermission}
                locationStatus={locationStatus}
                locationCoords={locationCoords}
                triggerNotificationPrompt={triggerNotificationPrompt}
                triggerLocationPrompt={triggerLocationPrompt}
                onTestPush={handleTestPush}
                onLogout={handleLogout}
              />
            )}

            {activeTab === "notifications" && (
              <NotificationsPage
                userId={userId}
                onBack={() => setActiveTab("home")}
              />
            )}
          </>
        )}
      </main>

      <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-104 p-1 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-3xl border border-zinc-200/40 dark:border-zinc-800/50 rounded-full shadow-2xl z-50 grid grid-cols-4 gap-1">
        <button
          onClick={() => setActiveTab("home")}
          className={`flex items-center justify-center space-x-1 py-2.5 rounded-full transition-all active:scale-95 ${
            activeTab === "home"
              ? "bg-yellow-400 text-black font-extrabold shadow-sm"
              : "text-zinc-400 hover:text-black dark:hover:text-white"
          }`}
        >
          <Home className="w-3.5 h-3.5" />
          <span className="text-[10px]">Home</span>
        </button>

        <button
          onClick={() => setActiveTab("session")}
          className={`flex items-center justify-center space-x-1 py-2.5 rounded-full transition-all active:scale-95 relative ${
            activeTab === "session"
              ? "bg-yellow-400 text-black font-extrabold shadow-sm"
              : "text-zinc-400 hover:text-black dark:hover:text-white"
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span className="text-[10px]">Session</span>
          {activeSession && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 absolute top-2 right-4 animate-ping" />
          )}
        </button>

        <button
          onClick={() => setActiveTab("contacts")}
          className={`flex items-center justify-center space-x-1 py-2.5 rounded-full transition-all active:scale-95 ${
            activeTab === "contacts"
              ? "bg-yellow-400 text-black font-extrabold shadow-sm"
              : "text-zinc-400 hover:text-black dark:hover:text-white"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span className="text-[10px]">Circle</span>
        </button>

        <button
          onClick={() => setActiveTab("share")}
          className={`flex items-center justify-center space-x-1 py-2.5 rounded-full transition-all active:scale-95 ${
            activeTab === "share"
              ? "bg-yellow-400 text-black font-extrabold shadow-sm"
              : "text-zinc-400 hover:text-black dark:hover:text-white"
          }`}
        >
          <Share2 className="w-3.5 h-3.5" />
          <span className="text-[10px]">Share</span>
        </button>
      </nav>
    </div>
  );
}