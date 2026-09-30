"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Radio,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  Clock,
  ShieldAlert,
  MapPin,
  X,
  Phone,
  Sparkles,
  ChevronRight,
  User,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Contact {
  id: string;
  name: string;
  phone: string;
}

interface SharedSession {
  id: string;
  user_phone: string;
  destination: string;
  expected_arrival_at: string;
  status: "active" | "completed" | "missed" | "escalated";
  notes?: string;
  media_url?: string;
  created_at: string;
  user?: {
    nickname?: string;
    full_name?: string;
  };
}

interface ContactsPageProps {
  userPhone: string;
  contacts: Contact[];
  addingContact: boolean;
  manualName: string;
  setManualName: (v: string) => void;
  manualPhone: string;
  setManualPhone: (v: string) => void;
  handleAddManualContact: (e: React.FormEvent) => void;
  handleDeleteContact: (id: string) => void;
  onContactAdded?: (contact: Contact) => void;
}

export function ContactsPage({
  userPhone,
  contacts,
  addingContact,
  manualName,
  setManualName,
  manualPhone,
  setManualPhone,
  handleAddManualContact,
  handleDeleteContact,
  onContactAdded,
}: ContactsPageProps) {
  const [subTab, setSubTab] = useState<"contacts" | "shared">("contacts");
  const [importError, setImportError] = useState(false);
  const [importing, setImporting] = useState(false);

  // Shared Sessions State
  const [sharedSessions, setSharedSessions] = useState<SharedSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [activeDetailSession, setActiveDetailSession] = useState<SharedSession | null>(null);

  // Fetch live shared sessions from friends in user's circle
  useEffect(() => {
    if (subTab === "shared") {
      fetchSharedSessions();
    }
  }, [subTab, contacts]);

  const fetchSharedSessions = async () => {
    setSessionsLoading(true);
    try {
      const contactPhones = contacts.map((c) => c.phone);
      if (contactPhones.length === 0) {
        setSharedSessions([]);
        setSessionsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("checkin_sessions")
        .select(`
          id,
          user_phone,
          destination,
          expected_arrival_at,
          status,
          notes,
          media_url,
          created_at
        `)
        .in("user_phone", contactPhones)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (!error && data) {
        // Fetch matching user details for display names
        const { data: usersData } = await supabase
          .from("users")
          .select("phone, nickname, full_name")
          .in("phone", contactPhones);

        const formatted = data.map((session) => {
          const matchedUser = usersData?.find((u) => u.phone === session.user_phone);
          return {
            ...session,
            user: matchedUser
              ? { nickname: matchedUser.nickname, full_name: matchedUser.full_name }
              : undefined,
          };
        });

        setSharedSessions(formatted);
      }
    } catch (err) {
      console.error("Error fetching shared sessions:", err);
    } finally {
      setSessionsLoading(false);
    }
  };

  // Attempt Web Contacts API automatically
  const handleAutoPickContacts = async () => {
    setImportError(false);
    setImporting(true);

    if (typeof window !== "undefined" && "contacts" in navigator && "ContactsManager" in window) {
      try {
        const props = ["name", "tel"];
        const selectedContacts = await (navigator as any).contacts.select(props, { multiple: false });

        if (selectedContacts && selectedContacts.length > 0) {
          const picked = selectedContacts[0];
          const name = picked.name?.[0] || "Circle Member";
          const phone = picked.tel?.[0] || "";

          if (phone) {
            const { data, error } = await supabase
              .from("trusted_contacts")
              .insert({
                user_phone: userPhone,
                name: name,
                phone: phone,
              })
              .select()
              .single();

            if (!error && data) {
              if (onContactAdded) onContactAdded(data);
              setImporting(false);
              return;
            }
          }
        }
        // If user cancelled or selection failed
        setImportError(true);
      } catch (err) {
        console.error("Auto contact import failed:", err);
        setImportError(true);
      }
    } else {
      // Browser doesn't support automatic contact picker
      setImportError(true);
    }
    setImporting(false);
  };

  return (
    <div className="space-y-5">
      {/* Pageview Segmented Control Bar */}
      <div className="p-1 bg-zinc-200/60 dark:bg-zinc-900/80 rounded-full grid grid-cols-2 gap-1 border border-zinc-300/40 dark:border-zinc-800">
        <button
          onClick={() => setSubTab("contacts")}
          className={`py-2 rounded-full text-xs font-black transition-all flex items-center justify-center space-x-1.5 ${
            subTab === "contacts"
              ? "bg-white dark:bg-zinc-800 text-black dark:text-white shadow-sm"
              : "text-zinc-400 hover:text-black dark:hover:text-white"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>My Circle</span>
        </button>

        <button
          onClick={() => setSubTab("shared")}
          className={`py-2 rounded-full text-xs font-black transition-all flex items-center justify-center space-x-1.5 relative ${
            subTab === "shared"
              ? "bg-white dark:bg-zinc-800 text-black dark:text-white shadow-sm"
              : "text-zinc-400 hover:text-black dark:hover:text-white"
          }`}
        >
          <Radio className="w-3.5 h-3.5 text-yellow-500 animate-pulse" />
          <span>Shared Sessions</span>
          {sharedSessions.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-yellow-400 absolute top-2 right-4" />
          )}
        </button>
      </div>

      {/* SUBVIEW 1: CIRCLE CONTACTS */}
      {subTab === "contacts" && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-black text-black dark:text-white">Circle Contacts 🛡️</h2>
            <p className="text-[11px] text-zinc-400">
              Your trusted network notified during walk sessions.
            </p>
          </div>

          {/* Automatic Contacts Trigger Button */}
          <button
            onClick={handleAutoPickContacts}
            disabled={importing}
            className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-black py-3.5 rounded-2xl text-xs flex items-center justify-center space-x-2 active:scale-[0.97] transition-all shadow-sm disabled:opacity-50"
          >
            {importing ? (
              <Loader2 className="w-4 h-4 animate-spin text-black" />
            ) : (
              <>
                <Users className="w-4 h-4" />
                <span>Add From Phone Contacts 📲</span>
              </>
            )}
          </button>

          {/* Failure Alert Box - ONLY SHOWN IF AUTOMATIC ACCESS FAILS */}
          {importError && (
            <div className="bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-2xl flex items-start space-x-2.5 text-amber-600 dark:text-amber-400 text-xs font-semibold animate-in fade-in slide-in-from-top-1">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-extrabold">Could not access phone contacts automatically.</p>
                <p className="text-[11px] opacity-90">
                  Please add your contact manually using the form below.
                </p>
              </div>
            </div>
          )}

          {/* Manual Entry Form */}
          <form
            onSubmit={handleAddManualContact}
            className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border border-zinc-200/50 dark:border-zinc-800/50 p-4 rounded-[26px] space-y-3 shadow-sm"
          >
            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
              Add Guardian Manually
            </p>
            <div className="space-y-2">
              <input
                type="text"
                required
                placeholder="Name (e.g. Ama)"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                className="w-full bg-zinc-100/70 dark:bg-black/40 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl px-3.5 py-2.5 text-xs text-black dark:text-white focus:outline-none focus:border-yellow-400"
              />
              <input
                type="tel"
                required
                placeholder="Phone Number (+233...)"
                value={manualPhone}
                onChange={(e) => setManualPhone(e.target.value)}
                className="w-full bg-zinc-100/70 dark:bg-black/40 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl px-3.5 py-2.5 text-xs text-black dark:text-white focus:outline-none focus:border-yellow-400"
              />
            </div>
            <button
              type="submit"
              disabled={addingContact}
              className="w-full bg-black dark:bg-white text-white dark:text-black font-extrabold py-3 rounded-xl text-xs flex items-center justify-center space-x-1.5 active:scale-[0.97] transition-all"
            >
              {addingContact ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Save Guardian</span>
                </>
              )}
            </button>
          </form>

          {/* Contacts List */}
          <div className="space-y-2">
            {contacts.length === 0 ? (
              <div className="text-center py-8 text-xs text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
                No circle contacts added yet.
              </div>
            ) : (
              contacts.map((c) => (
                <div
                  key={c.id}
                  className="bg-white/80 dark:bg-zinc-900/40 border border-zinc-200/50 dark:border-zinc-800/50 px-4 py-3 rounded-2xl flex items-center justify-between shadow-sm"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-full bg-zinc-900 text-yellow-400 font-black text-xs flex items-center justify-center uppercase border border-yellow-400/40">
                      {c.name.slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-black dark:text-white">{c.name}</p>
                      <p className="text-[11px] font-mono text-zinc-400">{c.phone}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteContact(c.id)}
                    className="p-2 text-zinc-400 hover:text-red-500 transition-colors active:scale-90"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SUBVIEW 2: SHARED SESSIONS INBOX */}
      {subTab === "shared" && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-black text-black dark:text-white">Shared Feeds 📡</h2>
            <p className="text-[11px] text-zinc-400">
              Live journey sessions shared with you by your circle.
            </p>
          </div>

          {sessionsLoading ? (
            <div className="py-12 flex justify-center items-center">
              <Loader2 className="w-6 h-6 animate-spin text-yellow-500" />
            </div>
          ) : sharedSessions.length === 0 ? (
            <div className="text-center py-12 px-4 bg-white/60 dark:bg-zinc-900/40 border border-zinc-200/50 dark:border-zinc-800/50 rounded-[26px] space-y-2">
              <Radio className="w-8 h-8 text-zinc-400 mx-auto" />
              <p className="text-xs font-extrabold text-black dark:text-white">No Active Shared Sessions</p>
              <p className="text-[11px] text-zinc-400 max-w-xs mx-auto">
                When contacts in your circle start a walk home session, their live updates will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {sharedSessions.map((s) => {
                const displayName =
                  s.user?.nickname ||
                  s.user?.full_name ||
                  contacts.find((c) => c.phone === s.user_phone)?.name ||
                  s.user_phone;

                return (
                  <div
                    key={s.id}
                    onClick={() => setActiveDetailSession(s)}
                    className="bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/50 dark:border-zinc-800/50 p-4 rounded-[22px] shadow-sm flex items-center justify-between cursor-pointer hover:border-yellow-400/50 active:scale-[0.98] transition-all group"
                  >
                    <div className="flex items-center space-x-3.5">
                      <div className="relative">
                        <div className="w-11 h-11 rounded-full bg-zinc-900 text-yellow-400 font-black text-sm flex items-center justify-center uppercase border border-yellow-400">
                          {displayName.slice(0, 2)}
                        </div>
                        <span className="w-3 h-3 bg-emerald-500 border-2 border-white dark:border-black rounded-full absolute bottom-0 right-0" />
                      </div>

                      <div>
                        <div className="flex items-center space-x-1.5">
                          <p className="text-xs font-extrabold text-black dark:text-white">
                            {displayName}
                          </p>
                          <span className="text-[9px] font-black uppercase bg-yellow-400 text-black px-1.5 py-0.2 rounded-full">
                            LIVE
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-0.5 flex items-center space-x-1">
                          <MapPin className="w-3 h-3 text-yellow-500" />
                          <span className="truncate max-w-44">{s.destination}</span>
                        </p>
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-black dark:group-hover:text-white transition-colors" />
                  </div>
                );
              })}
            </div>
          )}

          {/* SHARED SESSION DETAIL MODAL / PROFILE-LIKE VIEW */}
          {activeDetailSession && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md p-4 flex items-center justify-center animate-in fade-in">
              <div className="bg-zinc-900 text-white border border-zinc-800 rounded-4xl p-6 w-full max-w-sm space-y-5 relative shadow-2xl">
                <button
                  onClick={() => setActiveDetailSession(null)}
                  className="absolute top-4 right-4 p-2 rounded-full bg-zinc-800 text-zinc-400 hover:text-white active:scale-90 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Sender Header */}
                <div className="flex items-center space-x-3 pt-1">
                  <div className="w-14 h-14 rounded-full bg-yellow-400 text-black font-black text-lg flex items-center justify-center uppercase shadow-md">
                    {(
                      activeDetailSession.user?.nickname ||
                      contacts.find((c) => c.phone === activeDetailSession.user_phone)?.name ||
                      "ME"
                    ).slice(0, 2)}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">
                      {activeDetailSession.user?.nickname ||
                        contacts.find((c) => c.phone === activeDetailSession.user_phone)?.name ||
                        "Circle Friend"}
                    </h3>
                    <p className="text-xs font-mono text-zinc-400">{activeDetailSession.user_phone}</p>
                  </div>
                </div>

                {/* Session Live Watch Card */}
                <div className="bg-yellow-400 text-black rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center space-x-1 text-[9px] font-black uppercase bg-black text-yellow-400 px-2 py-0.5 rounded-full">
                      <Sparkles className="w-3 h-3 text-yellow-400" />
                      <span>Live Journey Active</span>
                    </span>
                    <Clock className="w-4 h-4 text-black" />
                  </div>

                  <div>
                    <p className="text-[9px] font-black uppercase text-black/60 tracking-wider">Destination</p>
                    <h4 className="text-lg font-black leading-tight">{activeDetailSession.destination}</h4>
                  </div>

                  <div className="bg-black/10 p-3 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-bold uppercase text-black/70">Expected Arrival</p>
                      <p className="text-xs font-black font-mono">
                        {new Date(activeDetailSession.expected_arrival_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <ShieldAlert className="w-5 h-5 text-black" />
                  </div>
                </div>

                {/* Notes or Attached Media */}
                {activeDetailSession.notes && (
                  <div className="bg-zinc-800/80 border border-zinc-700/60 p-3.5 rounded-2xl text-xs space-y-1">
                    <p className="text-[10px] font-black uppercase text-zinc-400">Guardian Note</p>
                    <p className="text-zinc-200">{activeDetailSession.notes}</p>
                  </div>
                )}

                {/* Direct Action Button */}
                <a
                  href={`tel:${activeDetailSession.user_phone}`}
                  className="w-full bg-white hover:bg-zinc-100 text-black font-black py-3.5 rounded-full text-xs flex items-center justify-center space-x-2 active:scale-95 transition-all shadow-md"
                >
                  <Phone className="w-4 h-4 fill-black" />
                  <span>Call Friend Immediately</span>
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}