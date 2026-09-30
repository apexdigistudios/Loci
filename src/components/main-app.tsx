"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Navigation, Users, Settings, User, Plus, ShieldAlert, Sparkles, MapPin, Clock, ChevronRight } from "lucide-react";
import { useTheme } from "next-themes";
import { supabase } from "@/lib/supabase";

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
    bg: "bg-yellow-400 text-black",
  },
  {
    id: 2,
    tag: "🌙 NIGHT WATCH",
    title: "Walking Late Tonight? 📱",
    desc: "Set your safety countdown before heading out!",
    bg: "bg-zinc-900 text-yellow-400 border border-yellow-400/30",
  },
  {
    id: 3,
    tag: "🔒 PRIVACY FIRST",
    title: "100% Protected 🛡️",
    desc: "Zero background tracking until you activate check-in!",
    bg: "bg-gradient-to-r from-yellow-400 to-amber-400 text-black",
  },
];

export function MainApp({ userPhone }: MainAppProps) {
  const [activeTab, setActiveTab] = useState<"session" | "contacts" | "settings">("session");
  const [nickname, setNickname] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);

  const [dataLoading, setDataLoading] = useState(true);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [mounted, setMounted] = useState(false);
  const { theme, resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-slide banner carousel every 3.5s
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % BANNERS.length);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  const loadUserData = useCallback(async () => {
    setDataLoading(true);

    const { data: userData } = await supabase
      .from("users")
      .select("nickname")
      .eq("phone", userPhone)
      .maybeSingle();

    if (userData?.nickname) {
      setNickname(userData.nickname);
    }

    const { data: contactsData } = await supabase
      .from("trusted_contacts")
      .select("id, name, phone")
      .eq("user_phone", userPhone)
      .order("created_at", { ascending: false });

    if (contactsData) {
      setContacts(contactsData);
    }

    const { data: sessionData } = await supabase
      .from("checkin_sessions")
      .select("id, destination, expected_arrival_at, status")
      .eq("user_phone", userPhone)
      .eq("status", "active")
      .maybeSingle();

    if (sessionData) {
      setActiveSession(sessionData);
    }

    setTimeout(() => {
      setDataLoading(false);
    }, 500);
  }, [userPhone]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  const isDark = mounted && (theme === "dark" || resolvedTheme === "dark");
  const logoSrc = isDark ? "/loci-dark.png" : "/loci-light.png";

  return (
    <div className="min-h-screen bg-zinc-100/60 dark:bg-black text-zinc-900 dark:text-zinc-100 flex flex-col justify-between max-w-md mx-auto w-full font-sans antialiased relative border-x border-zinc-200/50 dark:border-zinc-900 selection:bg-yellow-400 selection:text-black">
      {/* Compact iOS Header */}
      <header className="sticky top-0 z-30 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2.5 bg-white/70 dark:bg-black/70 backdrop-blur-3xl border-b border-zinc-200/40 dark:border-zinc-800/40 grid grid-cols-3 items-center">
        <div className="text-left truncate leading-none">
          <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 block mb-0.5">
            Welcome,
          </span>
          <span className="text-sm font-extrabold text-black dark:text-white truncate block">
            {dataLoading ? "..." : `${nickname} 👋`}
          </span>
        </div>

        <div className="flex justify-center items-center">
          <img src={logoSrc} alt="Loci Logo" className="h-7 w-auto object-contain" />
        </div>

        <div className="flex justify-end items-center">
          <button
            className="p-1.5 rounded-full text-zinc-400 hover:text-black dark:hover:text-white bg-zinc-100/80 dark:bg-zinc-900/80 active:scale-90 transition-all"
            title="Profile"
          >
            <User className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Body Content */}
      <main className="flex-1 px-4 py-5 space-y-5 pb-28">
        {dataLoading ? (
          /* Exact-Shape iOS Skeleton Loader */
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
            <div className="h-56 bg-zinc-200/80 dark:bg-zinc-900/80 rounded-[26px] w-full" />
          </div>
        ) : (
          <>
            {/* 1. iOS Banner Carousel */}
            <div className="relative overflow-hidden rounded-[26px] shadow-sm">
              <div
                className="flex transition-transform duration-500 ease-out"
                style={{ transform: `translateX(-${currentBanner * 100}%)` }}
              >
                {BANNERS.map((b) => (
                  <div
                    key={b.id}
                    className={`min-w-full p-5 ${b.bg} flex flex-col justify-between h-36 rounded-[26px]`}
                  >
                    <div className="space-y-1">
                      <span className="text-[9px] font-black tracking-widest px-2 py-0.5 rounded-full bg-black/10 dark:bg-white/10 backdrop-blur-md inline-block">
                        {b.tag}
                      </span>
                      <h3 className="text-base font-black tracking-tight leading-snug">
                        {b.title}
                      </h3>
                    </div>
                    <p className="text-[11px] font-medium opacity-85 leading-snug">
                      {b.desc}
                    </p>
                  </div>
                ))}
              </div>

              {/* Slider Dots */}
              <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex space-x-1 z-10">
                {BANNERS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentBanner(i)}
                    className={`h-1 rounded-full transition-all ${
                      currentBanner === i ? "w-4 bg-black dark:bg-white" : "w-1 bg-black/30 dark:bg-white/30"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* 2. Guardian Squad Avatars */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-black uppercase tracking-wider text-black dark:text-white flex items-center space-x-1.5">
                  <span>🛡️ Guardian Squad</span>
                  <span className="text-[10px] bg-yellow-400 text-black px-1.5 py-0.2 rounded-full font-black">
                    {contacts.length}
                  </span>
                </h2>
                <span className="text-[10px] font-bold text-zinc-400">Tap to add 🔥</span>
              </div>

              <div className="flex items-center space-x-3 overflow-x-auto pb-1 scrollbar-none">
                <button
                  onClick={() => setActiveTab("contacts")}
                  className="w-12 h-12 rounded-full border border-yellow-400/50 bg-yellow-400/10 hover:bg-yellow-400/20 text-yellow-500 flex items-center justify-center shrink-0 active:scale-90 transition-all"
                >
                  <Plus className="w-5 h-5 stroke-[2.5]" />
                </button>

                {contacts.map((c) => (
                  <div key={c.id} className="flex flex-col items-center space-y-1 shrink-0">
                    <div className="w-12 h-12 rounded-full bg-zinc-900 text-yellow-400 border border-yellow-400/80 font-black text-xs flex items-center justify-center uppercase shadow-sm">
                      {c.name.slice(0, 2)}
                    </div>
                    <span className="text-[9px] font-bold text-zinc-600 dark:text-zinc-400 max-w-12 truncate">
                      {c.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. iOS Safety Card */}
            {activeSession ? (
              <div className="bg-yellow-400 text-black rounded-[26px] p-5 shadow-lg space-y-4 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center space-x-1 text-[9px] font-black uppercase tracking-wider bg-black text-yellow-400 px-2.5 py-1 rounded-full">
                    <Sparkles className="w-3 h-3 text-yellow-400" />
                    <span>Active Journey 🔥</span>
                  </span>
                  <Clock className="w-4 h-4 text-black" />
                </div>

                <div>
                  <p className="text-[9px] font-black uppercase text-black/60 tracking-wider">Destination</p>
                  <h2 className="text-xl font-black tracking-tight leading-tight">{activeSession.destination}</h2>
                </div>

                <div className="bg-black/10 backdrop-blur-md p-3 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-bold uppercase text-black/70">ETA</p>
                    <p className="text-sm font-black font-mono">
                      {new Date(activeSession.expected_arrival_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <ShieldAlert className="w-6 h-6 text-black" />
                </div>

                <button
                  onClick={() => setActiveSession(null)}
                  className="w-full bg-black hover:bg-zinc-900 text-white font-black py-3.5 rounded-2xl text-xs transition-all flex items-center justify-center space-x-2 active:scale-[0.97]"
                >
                  <span>I Arrived Safely! 🎉</span>
                </button>
              </div>
            ) : (
              <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border border-zinc-200/50 dark:border-zinc-800/50 rounded-[26px] p-5 shadow-sm space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-yellow-400 text-black rounded-2xl shadow-sm">
                    <Navigation className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-black dark:text-white">
                      Start Walk Home Session 🚀
                    </h2>
                    <p className="text-[11px] font-medium text-zinc-400">
                      Auto-alert squad if arrival timer expires! ⚡
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  <div className="relative flex items-center">
                    <MapPin className="w-4 h-4 absolute left-3.5 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Where we headed today? 💥"
                      className="w-full bg-zinc-100/70 dark:bg-black/40 border border-zinc-200/60 dark:border-zinc-800/60 rounded-2xl pl-10 pr-4 py-3 text-xs font-semibold text-black dark:text-white focus:outline-none focus:border-yellow-400 transition-all"
                    />
                  </div>

                  <button
                    onClick={() => setActiveTab("session")}
                    className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-black py-3.5 rounded-2xl text-xs transition-all flex items-center justify-center space-x-1.5 active:scale-[0.97] shadow-sm"
                  >
                    <span>ACTIVATE WATCH SHIELD 🛡️</span>
                    <ChevronRight className="w-4 h-4 stroke-3" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Floating iOS Glass Navigation Bar */}
      <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-104 p-1 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-3xl border border-zinc-200/40 dark:border-zinc-800/50 rounded-full shadow-2xl z-30 grid grid-cols-3 gap-1">
        <button
          onClick={() => setActiveTab("session")}
          className={`flex items-center justify-center space-x-1.5 py-2.5 rounded-full transition-all active:scale-95 ${
            activeTab === "session"
              ? "bg-yellow-400 text-black font-extrabold shadow-sm"
              : "text-zinc-400 hover:text-black dark:hover:text-white"
          }`}
        >
          <Navigation className="w-3.5 h-3.5" />
          <span className="text-[10px]">Walk</span>
        </button>

        <button
          onClick={() => setActiveTab("contacts")}
          className={`flex items-center justify-center space-x-1.5 py-2.5 rounded-full transition-all active:scale-95 ${
            activeTab === "contacts"
              ? "bg-yellow-400 text-black font-extrabold shadow-sm"
              : "text-zinc-400 hover:text-black dark:hover:text-white"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span className="text-[10px]">Contacts</span>
        </button>

        <button
          onClick={() => setActiveTab("settings")}
          className={`flex items-center justify-center space-x-1.5 py-2.5 rounded-full transition-all active:scale-95 ${
            activeTab === "settings"
              ? "bg-yellow-400 text-black font-extrabold shadow-sm"
              : "text-zinc-400 hover:text-black dark:hover:text-white"
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span className="text-[10px]">Settings</span>
        </button>
      </nav>
    </div>
  );
}