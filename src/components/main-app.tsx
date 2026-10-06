"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Home, Shield, Users, Share2, User } from "lucide-react";
import { useTheme } from "next-themes";
import { supabase } from "@/lib/supabase";
import { cleanPhone } from "@/lib/utils";
import { requestNotificationPermission, type NotificationPermissionResult } from "@/lib/notifications";
import { subscribeToPush } from "@/lib/push";
import { prepareAlertFeedback } from "@/lib/alerts";

import { HomePage } from "@/components/pages/home-page";
import { SessionPage } from "@/components/pages/session-page";
import { ContactsPage, Contact } from "@/components/pages/contacts-page";
import { SharePage } from "@/components/pages/share-page";
import { ProfilePage } from "@/components/pages/profile-page";

interface MainAppProps {
  userPhone: string;
  onLogout: () => void;
}

interface ActiveSession {
  id: string;
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
    bg: "bg-zinc-900 text-white dark:bg-zinc-800/90 border border-zinc-800 dark:border-zinc-700/80",
  },
  {
    id: 2,
    tag: "🌙 NIGHT WATCH",
    title: "Walking Late Tonight? 📱",
    desc: "Set your safety countdown before heading out!",
    bg: "bg-black text-zinc-100 border border-zinc-800",
  },
  {
    id: 3,
    tag: "🔒 PRIVACY FIRST",
    title: "100% Protected 🛡️",
    desc: "Zero background tracking until you activate check-in!",
    bg: "bg-zinc-800 text-white border border-zinc-700/60",
  },
];

export function MainApp({ userPhone, onLogout }: MainAppProps) {
  const [activeTab, setActiveTab] = useState<"home" | "session" | "contacts" | "share" | "profile">("home");
  const [nickname, setNickname] = useState("");
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [receivedSessions, setReceivedSessions] = useState<ReceivedSession[]>([]);

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

  const [dataLoading, setDataLoading] = useState(true);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [requestedSharedSessionId, setRequestedSharedSessionId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const { theme, resolvedTheme } = useTheme();
  const notificationPermissionRequestRef = useRef<Promise<NotificationPermissionResult> | null>(null);

  const ensureNotificationPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return null;
    if (Notification.permission !== "default") {
      setNotificationPermission(Notification.permission);
      if (Notification.permission === "granted") void subscribeToPush(userPhone);
      return Notification.permission;
    }
    if (notificationPermissionRequestRef.current) return notificationPermissionRequestRef.current;

    const permissionRequest = requestNotificationPermission()
      .then((permission) => {
        if (permission !== "unsupported") setNotificationPermission(permission);
        if (permission === "granted") void subscribeToPush(userPhone);
        return permission;
      })
      .catch((err: unknown) => {
        console.error("Notification prompt error:", err);
        return Notification.permission;
      })
      .finally(() => {
        notificationPermissionRequestRef.current = null;
      });
    notificationPermissionRequestRef.current = permissionRequest;
    return permissionRequest;
  }, [userPhone]);

  useEffect(() => {
    setMounted(true);
    void ensureNotificationPermission();
  }, [ensureNotificationPermission]);

  useEffect(() => {
    const sharedSessionId = new URLSearchParams(window.location.search).get("sharedSessionId");
    if (!sharedSessionId) return;
    setRequestedSharedSessionId(sharedSessionId);
    setActiveTab("contacts");
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  const triggerNotificationPrompt = async () => {
    await ensureNotificationPermission();
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

  // Fetch contacts and cross-match their profile DPs dynamically
  const loadUserData = useCallback(async () => {
    setDataLoading(true);
    try {
      const { data: userData } = await supabase
        .from("users")
        .select("full_name, nickname, avatar_url")
        .eq("phone", userPhone)
        .maybeSingle();

      if (userData) {
        setFullName(userData.full_name || "");
        setNickname(userData.nickname || "");
        setAvatarUrl(userData.avatar_url || "");
      }

      const { data: contactsData } = await supabase
        .from("trusted_contacts")
        .select("id, name, phone, group_category")
        .eq("user_phone", userPhone)
        .order("created_at", { ascending: false });

      if (contactsData && contactsData.length > 0) {
        const phoneNumbers = contactsData.map((c) => c.phone);
        const { data: matchedUsers } = await supabase
          .from("users")
          .select("phone, avatar_url")
          .in("phone", phoneNumbers);

        const userAvatarMap = new Map(
          (matchedUsers || []).map((u) => [u.phone, u.avatar_url])
        );

        const formattedContacts: Contact[] = contactsData.map((c) => ({
          ...c,
          isLociUser: userAvatarMap.has(c.phone),
          avatar_url: userAvatarMap.get(c.phone) || undefined,
        }));

        setContacts(formattedContacts);
        setSelectedContactIds(formattedContacts.map((c) => c.id));
      } else {
        setContacts([]);
      }

      const { data: activeSessionRows } = await supabase
        .from("checkin_sessions")
        .select("id, user_phone, destination, expected_arrival_at, status, notes, user_reminder_mins, contact_reminder_mins, last_user_checkin_at")
        .eq("status", "active")
        .order("created_at", { ascending: false });
      const sessionData = activeSessionRows?.find((session) =>
        cleanPhone(session.user_phone) === cleanPhone(userPhone)
      );

      if (sessionData) {
        setActiveSession(sessionData);
        if (typeof window !== "undefined") {
          localStorage.setItem("loci_active_session", JSON.stringify(sessionData));
        }
      } else if (typeof window !== "undefined") {
        const cached = localStorage.getItem("loci_active_session");
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed.status === "active") {
              setActiveSession(parsed);
            }
          } catch (e) {
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
    loadUserData();
  }, [loadUserData]);

  const fetchReceivedSessions = useCallback(async () => {
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
  }, [contacts, userPhone]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchReceivedSessions();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchReceivedSessions]);

  // Realtime updates refresh feeds only; push dispatch is handled server-side.
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

  const toggleContactSelection = (id: string) => {
    setSelectedContactIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleStartSession = async (
    e: React.FormEvent,
    coordinates?: { latitude: number; longitude: number }
  ) => {
    e.preventDefault();
    void prepareAlertFeedback();
    await ensureNotificationPermission();
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

    try {
      const { data, error } = await supabase
        .from("checkin_sessions")
        .insert({
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

      if (!error && data) {
        setActiveSession(data);
        const selectedContacts = contacts.filter((contact) => selectedContactIds.includes(contact.id));
        if (selectedContacts.length > 0) {
          const { error: recipientsError } = await supabase
            .from("session_recipients")
            .insert(selectedContacts.map((contact) => ({
              session_id: data.id,
              contact_phone: contact.phone,
              recipient_phone: contact.phone,
            })));
          if (recipientsError) console.error("Failed to save session guardians:", recipientsError);
        }
        if (typeof window !== "undefined") {
          localStorage.setItem("loci_active_session", JSON.stringify(data));
        }
      }
    } catch (err) {
      console.error("Supabase Session creation error:", err);
    } finally {
      setSessionLoading(false);
      setDestination("");
      setNotes("");
    }
  };

  const handleSafeCheckin = async () => {
    if (!activeSession) return;
    const checkedInAt = new Date().toISOString();
    if (!activeSession.id.startsWith("local-")) {
      const { error } = await supabase
        .from("checkin_sessions")
        .update({ last_user_checkin_at: checkedInAt })
        .eq("id", activeSession.id)
        .eq("status", "active");
      if (error) {
        console.error("Failed to record safety check-in:", error);
        return;
      }
    }
    const updatedSession = { ...activeSession, last_user_checkin_at: checkedInAt };
    setActiveSession(updatedSession);
    if (typeof window !== "undefined") {
      localStorage.setItem("loci_active_session", JSON.stringify(updatedSession));
    }
  };

  const handleCompleteSession = async () => {
    const currentId = activeSession?.id;
    setActiveSession(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("loci_active_session");
    }

    if (currentId && !currentId.startsWith("local-")) {
      setSessionLoading(true);
      await supabase
        .from("checkin_sessions")
        .update({ status: "completed" })
        .eq("id", currentId);
      setSessionLoading(false);
    }
  };

  const handleAddManualContact = async (
    selectedGroup = "Emergency Circle",
    pendingContact?: { name: string; phone: string }
  ): Promise<boolean> => {
    const contactName = pendingContact?.name.trim() || manualName.trim();
    const contactPhone = (pendingContact?.phone || manualPhone).replace(/[\s\-\(\)]/g, "");
    if (!contactName || !/^\+\d{7,15}$/.test(contactPhone)) return false;

    setAddingContact(true);
    const { data: matchedUser } = await supabase
      .from("users")
      .select("phone, avatar_url")
      .eq("phone", contactPhone)
      .maybeSingle();

    const { data, error } = await supabase
      .from("trusted_contacts")
      .insert({
        user_phone: userPhone,
        name: contactName,
        phone: contactPhone,
        group_category: selectedGroup,
      })
      .select()
      .single();

    setAddingContact(false);

    if (!error && data) {
      const newContact: Contact = {
        ...data,
        isLociUser: !!matchedUser,
        avatar_url: matchedUser?.avatar_url || undefined,
      };

      setContacts((prev) => [newContact, ...prev]);
      setSelectedContactIds((prev) => [...prev, newContact.id]);
      setManualName("");
      setManualPhone("");
      return true;
    }
    if (error) console.error("Failed to add guardian contact:", error);
    return false;
  };

  const handleDeleteContact = async (id: string) => {
    const { error } = await supabase.from("trusted_contacts").delete().eq("id", id);
    if (!error) {
      setContacts((prev) => prev.filter((c) => c.id !== id));
      setSelectedContactIds((prev) => prev.filter((cId) => cId !== id));
    }
  };

  const isDark = mounted && (theme === "dark" || resolvedTheme === "dark");
  const sessionHeadingSrc = isDark ? "/session-dark.png" : "/session-light.png";

  return (
    <div className="min-h-screen bg-zinc-100/60 dark:bg-black text-zinc-900 dark:text-zinc-100 flex flex-col justify-between max-w-md mx-auto w-full font-sans antialiased relative border-x border-zinc-200/50 dark:border-zinc-900 selection:bg-yellow-400 selection:text-black">
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

          <div className="flex justify-end items-center">
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
                contacts={contacts}
                activeSession={activeSession}
                receivedSessions={receivedSessions}
                currentUserPhone={userPhone}
                onViewLiveFeed={(sessionId) => {
                  setRequestedSharedSessionId(sessionId);
                  setActiveTab("contacts");
                }}
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
                sessionHeadingSrc={sessionHeadingSrc}
                activeSession={activeSession}
                destination={destination}
                setDestination={setDestination}
                setDurationMinutes={setDurationMinutes}
                userReminderMins={userReminderMins}
                setUserReminderMins={setUserReminderMins}
                contactReminderMins={contactReminderMins}
                setContactReminderMins={setContactReminderMins}
                notes={notes}
                setNotes={setNotes}
                contacts={contacts}
                selectedContactIds={selectedContactIds}
                toggleContactSelection={toggleContactSelection}
                sessionLoading={sessionLoading}
                handleStartSession={handleStartSession}
                handleCompleteSession={handleCompleteSession}
                handleSafeCheckin={handleSafeCheckin}
                onNavigate={setActiveTab}
              />
            )}

            {activeTab === "contacts" && (
              <ContactsPage
                userPhone={userPhone}
                openSessionId={requestedSharedSessionId}
                onSessionOpened={() => setRequestedSharedSessionId(null)}
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
                fullName={fullName}
                nickname={nickname}
                userPhone={userPhone}
                avatarUrl={avatarUrl}
                onAvatarChange={(url) => setAvatarUrl(url)}
                notificationPermission={notificationPermission}
                locationStatus={locationStatus}
                locationCoords={locationCoords}
                triggerNotificationPrompt={triggerNotificationPrompt}
                triggerLocationPrompt={triggerLocationPrompt}
                onLogout={onLogout}
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