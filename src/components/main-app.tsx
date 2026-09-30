"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Home, Shield, Users, Share2, User } from "lucide-react";
import { useTheme } from "next-themes";
import { supabase } from "@/lib/supabase";

import { HomePage } from "@/components/pages/home-page";
import { SessionPage } from "@/components/pages/session-page";
import { ContactsPage } from "@/components/pages/contacts-page";
import { SharePage } from "@/components/pages/share-page";
import { ProfilePage } from "@/components/pages/profile-page";

interface MainAppProps {
  userPhone: string;
  onLogout: () => void;
}

interface Contact {
  id: string;
  name: string;
  phone: string;
}

interface ActiveSession {
  id: string;
  destination: string;
  expected_arrival_at: string;
  status: "active" | "completed" | "missed" | "escalated";
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
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);

  const [destination, setDestination] = useState("");
  const [durationMinutes, setDurationMinutes] = useState<number | "">(30);
  const [notes, setNotes] = useState("");
  const [sessionLoading, setSessionLoading] = useState(false);

  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [addingContact, setAddingContact] = useState(false);

  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "granted" | "denied">("idle");
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");

  const [dataLoading, setDataLoading] = useState(true);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [mounted, setMounted] = useState(false);
  const { theme, resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);

    if (typeof window !== "undefined") {
      if ("Notification" in window) {
        setNotificationPermission(Notification.permission);
      }
    }
  }, []);

  const triggerNotificationPrompt = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      try {
        const perm = await Notification.requestPermission();
        setNotificationPermission(perm);
      } catch (err) {
        console.error("Notification prompt error:", err);
      }
    }
  };

  const triggerLocationPrompt = () => {
    if (typeof window !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocationCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocationStatus("granted");
        },
        (err) => {
          console.warn("Location permission error:", err);
          setLocationStatus("denied");
        },
        { enableHighAccuracy: true }
      );
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % BANNERS.length);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  const loadUserData = useCallback(async () => {
    setDataLoading(true);
    try {
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("full_name, nickname")
        .eq("phone", userPhone)
        .maybeSingle();

      if (userError) console.error("User query error:", userError);
      if (userData) {
        setFullName(userData.full_name || "");
        setNickname(userData.nickname || "");
      }

      const { data: contactsData, error: contactsError } = await supabase
        .from("trusted_contacts")
        .select("id, name, phone")
        .eq("user_phone", userPhone)
        .order("created_at", { ascending: false });

      if (contactsError) console.error("Contacts query error:", contactsError);
      if (contactsData) {
        setContacts(contactsData);
        setSelectedContactIds(contactsData.map((c) => c.id));
      }

      const { data: sessionData, error: sessionError } = await supabase
        .from("checkin_sessions")
        .select("id, destination, expected_arrival_at, status")
        .eq("user_phone", userPhone)
        .eq("status", "active")
        .maybeSingle();

      if (sessionError) console.error("Session query error:", sessionError);
      if (sessionData) {
        setActiveSession(sessionData);
      }
    } catch (err) {
      console.error("Failed to fetch initial data:", err);
    } finally {
      setDataLoading(false);
    }
  }, [userPhone]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  const toggleContactSelection = (id: string) => {
    setSelectedContactIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalMins = Number(durationMinutes);
    if (!destination.trim() || !finalMins || finalMins <= 0) return;

    setSessionLoading(true);
    const arrivalTime = new Date(Date.now() + finalMins * 60000).toISOString();

    const { data, error } = await supabase
      .from("checkin_sessions")
      .insert({
        user_phone: userPhone,
        destination: destination.trim(),
        expected_arrival_at: arrivalTime,
        status: "active",
        notes: notes.trim() || null,
      })
      .select()
      .single();

    setSessionLoading(false);

    if (!error && data) {
      setActiveSession(data);
      setDestination("");
      setNotes("");
    }
  };

  const handleCompleteSession = async () => {
    if (!activeSession) return;

    setSessionLoading(true);
    const { error } = await supabase
      .from("checkin_sessions")
      .update({ status: "completed" })
      .eq("id", activeSession.id);

    setSessionLoading(false);

    if (!error) {
      setActiveSession(null);
    }
  };

  const handleAddManualContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim() || !manualPhone.trim()) return;

    setAddingContact(true);
    const { data, error } = await supabase
      .from("trusted_contacts")
      .insert({
        user_phone: userPhone,
        name: manualName.trim(),
        phone: manualPhone.trim(),
      })
      .select()
      .single();

    setAddingContact(false);

    if (!error && data) {
      setContacts((prev) => [data, ...prev]);
      setSelectedContactIds((prev) => [...prev, data.id]);
      setManualName("");
      setManualPhone("");
    }
  };

  const handleDeleteContact = async (id: string) => {
    const { error } = await supabase.from("trusted_contacts").delete().eq("id", id);
    if (!error) {
      setContacts((prev) => prev.filter((c) => c.id !== id));
      setSelectedContactIds((prev) => prev.filter((cId) => cId !== id));
    }
  };

  const isDark = mounted && (theme === "dark" || resolvedTheme === "dark");
  const logoSrc = isDark ? "/loci-dark.png" : "/loci-light.png";
  const sessionHeadingSrc = isDark ? "/session-dark.png" : "/session-light.png";

  return (
    <div className="min-h-screen bg-zinc-100/60 dark:bg-black text-zinc-900 dark:text-zinc-100 flex flex-col justify-between max-w-md mx-auto w-full font-sans antialiased relative border-x border-zinc-200/50 dark:border-zinc-900 selection:bg-yellow-400 selection:text-black">
      {/* Top Header */}
      {activeTab !== "session" && (
        <header className="sticky top-0 z-30 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2.5 bg-white/70 dark:bg-black/70 backdrop-blur-3xl border-b border-zinc-200/40 dark:border-zinc-800/40 grid grid-cols-3 items-center">
          <div className="text-left truncate leading-none">
            <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 block mb-0.5">
              Welcome,
            </span>
            <span className="text-sm font-extrabold text-black dark:text-white truncate block">
              {dataLoading ? "..." : `${nickname || "Guardian"} 👋`}
            </span>
          </div>

          <div className="flex justify-center items-center">
            <img src={logoSrc} alt="Loci Logo" className="h-7 w-auto object-contain" />
          </div>

          <div className="flex justify-end items-center">
            <button
              onClick={() => setActiveTab("profile")}
              className={`p-1.5 rounded-full text-zinc-400 hover:text-black dark:hover:text-white transition-all active:scale-90 ${
                activeTab === "profile"
                  ? "bg-yellow-400 text-black font-extrabold"
                  : "bg-zinc-100/80 dark:bg-zinc-900/80"
              }`}
              title="Profile & Settings"
            >
              <User className="w-4 h-4" />
            </button>
          </div>
        </header>
      )}

      {/* Main Content View Switcher */}
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
                currentBanner={currentBanner}
                setCurrentBanner={setCurrentBanner}
                banners={BANNERS}
                contactsSupported={true}
                handlePickDeviceContact={() => setActiveTab("contacts")}
                handleCompleteSession={handleCompleteSession}
                onNavigate={setActiveTab}
              />
            )}

            {activeTab === "session" && (
              <SessionPage
                sessionHeadingSrc={sessionHeadingSrc}
                activeSession={activeSession}
                destination={destination}
                setDestination={setDestination}
                durationMinutes={durationMinutes}
                setDurationMinutes={setDurationMinutes}
                notes={notes}
                setNotes={setNotes}
                contacts={contacts}
                selectedContactIds={selectedContactIds}
                toggleContactSelection={toggleContactSelection}
                sessionLoading={sessionLoading}
                handleStartSession={handleStartSession}
                handleCompleteSession={handleCompleteSession}
                onNavigate={setActiveTab}
              />
            )}

            {activeTab === "contacts" && (
              <ContactsPage
                userPhone={userPhone}
                contacts={contacts}
                addingContact={addingContact}
                manualName={manualName}
                setManualName={setManualName}
                manualPhone={manualPhone}
                setManualPhone={setManualPhone}
                handleAddManualContact={handleAddManualContact}
                handleDeleteContact={handleDeleteContact}
                onContactAdded={(newC) => {
                  setContacts((prev) => [newC, ...prev]);
                  setSelectedContactIds((prev) => [...prev, newC.id]);
                }}
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

      {/* Floating Bottom Navigation Bar */}
      <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-104 p-1 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-3xl border border-zinc-200/40 dark:border-zinc-800/50 rounded-full shadow-2xl z-30 grid grid-cols-4 gap-1">
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
          className={`flex items-center justify-center space-x-1 py-2.5 rounded-full transition-all active:scale-95 ${
            activeTab === "session"
              ? "bg-yellow-400 text-black font-extrabold shadow-sm"
              : "text-zinc-400 hover:text-black dark:hover:text-white"
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span className="text-[10px]">Session</span>
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