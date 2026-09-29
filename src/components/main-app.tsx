"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Navigation,
  Users,
  Settings,
  Plus,
  LogOut,
  Trash2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  Sun,
  Moon,
} from "lucide-react";
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

export function MainApp({ userPhone, onLogout }: MainAppProps) {
  const [activeTab, setActiveTab] = useState<"session" | "contacts" | "settings">("session");
  const { theme, setTheme } = useTheme();

  // User Profile
  const [nickname, setNickname] = useState("");
  const [fullName, setFullName] = useState("");

  // Contacts State
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [addingContact, setAddingContact] = useState(false);

  // Check-In Session State
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [destination, setDestination] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  // Fetch initial user data, contacts, and active session
  const loadUserData = useCallback(async () => {
    setDataLoading(true);

    // 1. Fetch Profile
    const { data: userData } = await supabase
      .from("users")
      .select("full_name, nickname")
      .eq("phone", userPhone)
      .maybeSingle();

    if (userData) {
      setFullName(userData.full_name);
      setNickname(userData.nickname);
    }

    // 2. Fetch Trusted Contacts
    const { data: contactsData } = await supabase
      .from("trusted_contacts")
      .select("id, name, phone")
      .eq("user_phone", userPhone)
      .order("created_at", { ascending: false });

    if (contactsData) {
      setContacts(contactsData);
    }

    // 3. Fetch Active Session
    const { data: sessionData } = await supabase
      .from("checkin_sessions")
      .select("id, destination, expected_arrival_at, status")
      .eq("user_phone", userPhone)
      .eq("status", "active")
      .maybeSingle();

    if (sessionData) {
      setActiveSession(sessionData);
    } else {
      setActiveSession(null);
    }

    setDataLoading(false);
  }, [userPhone]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  // Handle Add Contact
  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName.trim() || !newContactPhone.trim()) return;

    setAddingContact(true);
    const { data, error } = await supabase
      .from("trusted_contacts")
      .insert({
        user_phone: userPhone,
        name: newContactName.trim(),
        phone: newContactPhone.trim(),
      })
      .select()
      .single();

    setAddingContact(false);

    if (!error && data) {
      setContacts((prev) => [data, ...prev]);
      setNewContactName("");
      setNewContactPhone("");
    }
  };

  // Handle Delete Contact
  const handleDeleteContact = async (id: string) => {
    const { error } = await supabase.from("trusted_contacts").delete().eq("id", id);
    if (!error) {
      setContacts((prev) => prev.filter((c) => c.id !== id));
    }
  };

  // Handle Start Session
  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination.trim()) return;

    setSessionLoading(true);
    const arrivalTime = new Date(Date.now() + durationMinutes * 60000).toISOString();

    const { data, error } = await supabase
      .from("checkin_sessions")
      .insert({
        user_phone: userPhone,
        destination: destination.trim(),
        expected_arrival_at: arrivalTime,
        status: "active",
      })
      .select()
      .single();

    setSessionLoading(false);

    if (!error && data) {
      setActiveSession(data);
      setDestination("");
    }
  };

  // Handle Safe Check-In (Complete Session)
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

  return (
    <div className="min-h-screen bg-white dark:bg-black text-zinc-900 dark:text-zinc-100 flex flex-col justify-between max-w-md mx-auto w-full border-x border-zinc-200 dark:border-zinc-900 font-sans antialiased">
      {/* Header with App Logo */}
      <header className="p-4 border-b border-zinc-200 dark:border-zinc-900 flex items-center justify-between sticky top-0 bg-white/90 dark:bg-black/90 backdrop-blur-md z-20">
        <div className="flex items-center">
          <img src="/logo.png" alt="Loci Logo" className="h-7 w-auto object-contain" />
        </div>

        <div className="flex items-center space-x-2">
          {activeSession ? (
            <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-yellow-400 text-black">
              <span className="h-1.5 w-1.5 rounded-full bg-black animate-ping" />
              <span>ACTIVE SESSION</span>
            </span>
          ) : (
            <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>STANDBY</span>
            </span>
          )}

          <button
            onClick={onLogout}
            className="p-2 rounded-xl text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Content Body */}
      <main className="flex-1 p-5 space-y-6">
        {dataLoading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-6 h-6 animate-spin text-yellow-400" />
            <p className="text-xs text-zinc-500">Syncing with Supabase...</p>
          </div>
        ) : (
          <>
            {/* 1. SESSION TAB */}
            {activeTab === "session" && (
              <div className="space-y-6">
                {activeSession ? (
                  /* Active Session Card */
                  <div className="bg-yellow-400 text-black rounded-2xl p-6 shadow-xl space-y-5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest bg-black text-yellow-400 px-2.5 py-1 rounded-md">
                        Check-In Running
                      </span>
                      <Clock className="w-5 h-5 text-black" />
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase text-black/70">Heading To</p>
                      <h2 className="text-2xl font-extrabold text-black leading-tight">
                        {activeSession.destination}
                      </h2>
                    </div>

                    <div className="bg-black/10 p-3.5 rounded-xl text-xs space-y-1">
                      <p className="font-bold text-black">Expected Arrival</p>
                      <p className="text-black/80 font-mono">
                        {new Date(activeSession.expected_arrival_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>

                    <button
                      onClick={handleCompleteSession}
                      disabled={sessionLoading}
                      className="w-full bg-black text-white hover:bg-zinc-900 font-bold py-4 rounded-xl text-sm transition-all flex items-center justify-center space-x-2 active:scale-[0.98] shadow-md"
                    >
                      {sessionLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-yellow-400" />
                      ) : (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-yellow-400" />
                          <span>I Have Arrived Safely</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  /* New Session Form */
                  <div className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2.5 bg-yellow-400 text-black rounded-xl">
                        <Navigation className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-base font-extrabold text-black dark:text-white">
                          Start Safety Session
                        </h2>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          Notify contacts automatically if you miss arrival time.
                        </p>
                      </div>
                    </div>

                    <form onSubmit={handleStartSession} className="space-y-4 pt-2">
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                          Destination / Purpose
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g., Walking home from lab"
                          value={destination}
                          onChange={(e) => setDestination(e.target.value)}
                          className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-black dark:text-white focus:outline-none focus:border-yellow-400 dark:focus:border-yellow-400 transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                          Expected Duration
                        </label>
                        <select
                          value={durationMinutes}
                          onChange={(e) => setDurationMinutes(Number(e.target.value))}
                          className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-black dark:text-white focus:outline-none focus:border-yellow-400 dark:focus:border-yellow-400 transition-colors"
                        >
                          <option value={15}>15 minutes</option>
                          <option value={30}>30 minutes</option>
                          <option value={45}>45 minutes</option>
                          <option value={60}>1 hour</option>
                          <option value={120}>2 hours</option>
                        </select>
                      </div>

                      {contacts.length === 0 && (
                        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start space-x-2 text-xs text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                          <span>Add at least one trusted contact so alerts can be sent.</span>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={sessionLoading || contacts.length === 0}
                        className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-extrabold py-3.5 rounded-xl text-sm transition-all flex items-center justify-center space-x-2 active:scale-[0.98] disabled:opacity-50"
                      >
                        {sessionLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <span>Start Walk Home Session</span>
                        )}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* 2. CONTACTS TAB */}
            {activeTab === "contacts" && (
              <div className="space-y-6">
                <div className="space-y-1">
                  <h2 className="text-lg font-bold text-black dark:text-white">Trusted Contacts</h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Contacts will receive check-in updates and missed check-in alerts.
                  </p>
                </div>

                {/* Add Contact Form */}
                <form
                  onSubmit={handleAddContact}
                  className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl space-y-3"
                >
                  <p className="text-xs font-bold uppercase tracking-wider text-black dark:text-white">
                    Add New Contact
                  </p>
                  <div className="space-y-2">
                    <input
                      type="text"
                      required
                      placeholder="Contact Name (e.g., Kwame)"
                      value={newContactName}
                      onChange={(e) => setNewContactName(e.target.value)}
                      className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-black dark:text-white focus:outline-none focus:border-yellow-400"
                    />
                    <input
                      type="tel"
                      required
                      placeholder="Phone Number (e.g., +233...)"
                      value={newContactPhone}
                      onChange={(e) => setNewContactPhone(e.target.value)}
                      className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-black dark:text-white focus:outline-none focus:border-yellow-400"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={addingContact}
                    className="w-full bg-black dark:bg-white text-white dark:text-black font-bold py-2.5 rounded-xl text-xs flex items-center justify-center space-x-1 transition-all"
                  >
                    {addingContact ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>Save Contact</span>
                      </>
                    )}
                  </button>
                </form>

                {/* Contacts List */}
                <div className="space-y-2">
                  {contacts.length === 0 ? (
                    <div className="text-center py-8 text-xs text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
                      No contacts added yet.
                    </div>
                  ) : (
                    contacts.map((c) => (
                      <div
                        key={c.id}
                        className="bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 p-3.5 rounded-xl flex items-center justify-between"
                      >
                        <div>
                          <p className="text-xs font-bold text-black dark:text-white">{c.name}</p>
                          <p className="text-[11px] text-zinc-500 font-mono">{c.phone}</p>
                        </div>
                        <button
                          onClick={() => handleDeleteContact(c.id)}
                          className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 3. SETTINGS TAB */}
            {activeTab === "settings" && (
              <div className="space-y-6">
                <div className="space-y-1">
                  <h2 className="text-lg font-bold text-black dark:text-white">Account & Theme</h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Manage your profile details and appearance preferences.
                  </p>
                </div>

                <div className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3 text-xs">
                  <div className="flex justify-between items-center py-2 border-b border-zinc-200 dark:border-zinc-800">
                    <span className="text-zinc-500">Full Name</span>
                    <span className="font-bold text-black dark:text-white">{fullName || "—"}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-zinc-200 dark:border-zinc-800">
                    <span className="text-zinc-500">Nickname</span>
                    <span className="font-bold text-black dark:text-white">{nickname || "—"}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-zinc-500">Registered Phone</span>
                    <span className="font-mono font-bold text-black dark:text-white">{userPhone}</span>
                  </div>
                </div>

                {/* Theme Selector */}
                <div className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-black dark:text-white">Appearance</p>
                    <p className="text-[11px] text-zinc-500">Toggle Light / Dark mode</p>
                  </div>
                  <button
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    className="p-2.5 bg-zinc-200 dark:bg-zinc-800 rounded-xl text-black dark:text-white transition-all flex items-center space-x-1.5"
                  >
                    {theme === "dark" ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-black" />}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="p-3 border-t border-zinc-200 dark:border-zinc-900 bg-white/90 dark:bg-black/90 backdrop-blur-md grid grid-cols-3 gap-1 text-center sticky bottom-0 z-20">
        <button
          onClick={() => setActiveTab("session")}
          className={`flex flex-col items-center py-2 px-3 rounded-xl transition-all ${
            activeTab === "session"
              ? "text-black bg-yellow-400 font-extrabold shadow-sm"
              : "text-zinc-400 hover:text-black dark:hover:text-white"
          }`}
        >
          <Navigation className="w-4 h-4 mb-1" />
          <span className="text-[10px]">Session</span>
        </button>

        <button
          onClick={() => setActiveTab("contacts")}
          className={`flex flex-col items-center py-2 px-3 rounded-xl transition-all ${
            activeTab === "contacts"
              ? "text-black bg-yellow-400 font-extrabold shadow-sm"
              : "text-zinc-400 hover:text-black dark:hover:text-white"
          }`}
        >
          <Users className="w-4 h-4 mb-1" />
          <span className="text-[10px]">Contacts</span>
        </button>

        <button
          onClick={() => setActiveTab("settings")}
          className={`flex flex-col items-center py-2 px-3 rounded-xl transition-all ${
            activeTab === "settings"
              ? "text-black bg-yellow-400 font-extrabold shadow-sm"
              : "text-zinc-400 hover:text-black dark:hover:text-white"
          }`}
        >
          <Settings className="w-4 h-4 mb-1" />
          <span className="text-[10px]">Settings</span>
        </button>
      </nav>
    </div>
  );
}