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
  Shield,
  Heart,
  UserCheck,
  ChevronLeft,
  FolderPlus,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

export interface Contact {
  id: string;
  name: string;
  phone: string;
  group_category?: string;
  isLociUser?: boolean;
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
  handleAddManualContact: (e: React.FormEvent, selectedGroup?: string) => void;
  handleDeleteContact: (id: string) => void;
  onContactAdded?: (contact: Contact) => void;
}

const DEFAULT_GROUPS = [
  {
    key: "Emergency Circle",
    label: "Emergency Circle",
    icon: ShieldAlert,
    accent: "from-red-500/20 to-amber-500/10 border-red-500/30 text-red-500",
    badgeBg: "bg-red-500/20 text-red-400 border-red-500/40",
    desc: "First responders & primary emergency guardians",
  },
  {
    key: "Family",
    label: "Family",
    icon: Heart,
    accent: "from-yellow-400/20 to-amber-500/10 border-yellow-400/40 text-yellow-400",
    badgeBg: "bg-yellow-400/20 text-yellow-400 border-yellow-400/40",
    desc: "Parents, siblings & immediate family",
  },
  {
    key: "Besties",
    label: "Besties",
    icon: Sparkles,
    accent: "from-zinc-800 to-zinc-900 border-zinc-700/60 text-zinc-200",
    badgeBg: "bg-zinc-800 text-zinc-300 border-zinc-700",
    desc: "Close friends, roommates & ride partners",
  },
];

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
  const [activeGroupView, setActiveGroupView] = useState<string | null>(null);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string>("Emergency Circle");
  const [customGroupInput, setCustomGroupInput] = useState("");
  const [showCustomGroupField, setShowCustomGroupField] = useState(false);
  const [customGroups, setCustomGroups] = useState<string[]>([]);

  const [importError, setImportError] = useState(false);
  const [importing, setImporting] = useState(false);

  // Shared Sessions State
  const [sharedSessions, setSharedSessions] = useState<SharedSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [activeDetailSession, setActiveDetailSession] = useState<SharedSession | null>(null);

  useEffect(() => {
    if (subTab === "shared") {
      fetchSharedSessions();
    }
  }, [subTab, contacts]);

  // Bidirectional Supabase Contact & Session Fetching
  const fetchSharedSessions = async () => {
    setSessionsLoading(true);
    try {
      const contactPhones = contacts.map((c) => c.phone);

      // Query sessions where user is either in their circle OR friend added this user
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
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (!error && data) {
        // Filter sessions by matching contact numbers or user linkage
        const matchingSessions = data.filter(
          (s) => contactPhones.includes(s.user_phone) || s.user_phone !== userPhone
        );

        const senderPhones = Array.from(new Set(matchingSessions.map((s) => s.user_phone)));

        const { data: usersData } = await supabase
          .from("users")
          .select("phone, nickname, full_name")
          .in("phone", senderPhones.length > 0 ? senderPhones : ["none"]);

        const formatted = matchingSessions.map((session) => {
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
                group_category: selectedGroup,
              })
              .select()
              .single();

            if (!error && data) {
              if (onContactAdded) onContactAdded(data);
              setImporting(false);
              setShowAddModal(false);
              return;
            }
          }
        }
        setImportError(true);
      } catch (err) {
        console.error("Auto contact import failed:", err);
        setImportError(true);
      }
    } else {
      setImportError(true);
    }
    setImporting(false);
  };

  const handleCreateCustomGroup = () => {
    if (!customGroupInput.trim()) return;
    const gName = customGroupInput.trim();
    if (!customGroups.includes(gName)) {
      setCustomGroups((prev) => [...prev, gName]);
    }
    setSelectedGroup(gName);
    setCustomGroupInput("");
    setShowCustomGroupField(false);
  };

  const submitManualWithGroup = (e: React.FormEvent) => {
    e.preventDefault();
    handleAddManualContact(e, selectedGroup);
    setShowAddModal(false);
  };

  const allGroups = [
    ...DEFAULT_GROUPS,
    ...customGroups.map((cg) => ({
      key: cg,
      label: cg,
      icon: Users,
      accent: "from-zinc-800 to-zinc-900 border-zinc-700/60 text-zinc-200",
      badgeBg: "bg-zinc-800 text-zinc-300 border-zinc-700",
      desc: "Custom guardian group",
    })),
  ];

  const groupContacts = contacts.filter(
    (c) => (c.group_category || "Emergency Circle") === activeGroupView
  );

  return (
    <div className="space-y-5">
      {/* Top Segmented SubTab Control */}
      <div className="p-1 bg-zinc-200/60 dark:bg-zinc-900/80 rounded-full grid grid-cols-2 gap-1 border border-zinc-300/40 dark:border-zinc-800">
        <button
          onClick={() => {
            setSubTab("contacts");
            setActiveGroupView(null);
          }}
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

      {/* SUBVIEW 1: MY CIRCLE BENTO GRID & GROUPS */}
      {subTab === "contacts" && (
        <>
          {activeGroupView ? (
            /* INDIVIDUAL GROUP PAGEVIEW DRILLDOWN */
            <div className="space-y-4 animate-in fade-in slide-in-from-right-2">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setActiveGroupView(null)}
                  className="p-2.5 rounded-full bg-zinc-200/60 dark:bg-zinc-900/60 backdrop-blur-xl text-black dark:text-white active:scale-90 transition-all shadow-sm flex items-center space-x-1 pr-3.5 border border-zinc-300/40 dark:border-zinc-800"
                >
                  <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                  <span className="text-xs font-bold">Groups</span>
                </button>

                <button
                  onClick={() => {
                    setSelectedGroup(activeGroupView);
                    setShowAddModal(true);
                  }}
                  className="w-9 h-9 rounded-full bg-yellow-400 text-black flex items-center justify-center font-black active:scale-90 transition-all shadow-md shadow-yellow-400/20"
                >
                  <Plus className="w-5 h-5 stroke-3" />
                </button>
              </div>

              <div className="bg-zinc-900 text-white p-5 rounded-[28px] border border-zinc-800 space-y-1 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-10">
                  <Shield className="w-24 h-24 text-yellow-400" />
                </div>
                <span className="text-[10px] font-black uppercase text-yellow-400 tracking-wider">
                  Group Circle
                </span>
                <h3 className="text-xl font-extrabold">{activeGroupView}</h3>
                <p className="text-xs text-zinc-400">
                  {groupContacts.length} Linked Guardians in this circle
                </p>
              </div>

              {/* Contacts inside active group */}
              <div className="space-y-2">
                {groupContacts.length === 0 ? (
                  <div className="text-center py-10 px-4 bg-white/60 dark:bg-zinc-900/40 border border-zinc-200/50 dark:border-zinc-800/50 rounded-[26px] space-y-2">
                    <UserCheck className="w-8 h-8 text-zinc-500 mx-auto" />
                    <p className="text-xs font-extrabold text-black dark:text-white">
                      No contacts in {activeGroupView} yet
                    </p>
                    <button
                      onClick={() => {
                        setSelectedGroup(activeGroupView);
                        setShowAddModal(true);
                      }}
                      className="inline-flex items-center space-x-1.5 bg-yellow-400 text-black px-4 py-2 rounded-full text-xs font-black shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Guardian to {activeGroupView}</span>
                    </button>
                  </div>
                ) : (
                  groupContacts.map((c) => (
                    <div
                      key={c.id}
                      className="bg-white/80 dark:bg-zinc-900/60 border border-zinc-200/50 dark:border-zinc-800/50 px-4 py-3.5 rounded-2xl flex items-center justify-between shadow-sm"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-zinc-900 text-yellow-400 font-black text-xs flex items-center justify-center uppercase border border-yellow-400/40">
                          {c.name.slice(0, 2)}
                        </div>
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <p className="text-xs font-extrabold text-black dark:text-white">
                              {c.name}
                            </p>
                            {c.isLociUser && (
                              <span className="bg-yellow-400 text-black text-[9px] px-1.5 py-0.2 rounded-full font-black uppercase">
                                Loci Member
                              </span>
                            )}
                          </div>
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
          ) : (
            /* BENTO GRID OVERVIEW WITH TOP-RIGHT FLOATING BUBBLE (+) BUTTON */
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h2 className="text-base font-black text-black dark:text-white">My Circle 🛡️</h2>
                  <p className="text-[11px] text-zinc-400">
                    Organized guardian circles for instant safety dispatch.
                  </p>
                </div>

                {/* Top Right Floating Plus Bubble Button */}
                <button
                  onClick={() => setShowAddModal(true)}
                  className="w-11 h-11 rounded-full bg-yellow-400 text-black flex items-center justify-center active:scale-90 transition-all shadow-lg shadow-yellow-400/20 border-2 border-yellow-300"
                  title="Add Guardian or Group"
                >
                  <Plus className="w-6 h-6 stroke-3" />
                </button>
              </div>

              {/* Bento Grid Layout */}
              <div className="grid grid-cols-2 gap-3">
                {allGroups.map((grp, idx) => {
                  const IconComp = grp.icon;
                  const count = contacts.filter(
                    (c) => (c.group_category || "Emergency Circle") === grp.key
                  ).length;

                  // First item takes wide span for bento aesthetic
                  const isWide = idx === 0;

                  return (
                    <div
                      key={grp.key}
                      onClick={() => setActiveGroupView(grp.key)}
                      className={`p-4 rounded-[26px] bg-linear-to-br ${grp.accent} border backdrop-blur-xl relative overflow-hidden cursor-pointer active:scale-95 transition-all shadow-sm flex flex-col justify-between ${
                        isWide ? "col-span-2 min-h-32" : "min-h-36"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="p-2.5 rounded-2xl bg-black/40 backdrop-blur-md">
                          <IconComp className="w-5 h-5 text-yellow-400" />
                        </div>
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${grp.badgeBg}`}>
                          {count} Linked
                        </span>
                      </div>

                      <div className="pt-3">
                        <h3 className="text-sm font-black text-black dark:text-white">{grp.label}</h3>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 line-clamp-1">
                          {grp.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ADD GUARDIAN / GROUP MODAL POPUP */}
          {showAddModal && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md p-4 flex items-center justify-center animate-in fade-in">
              <div className="bg-zinc-900 text-white border border-zinc-800 rounded-4xl p-6 w-full max-w-sm space-y-5 relative shadow-2xl">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="absolute top-4 right-4 p-2 rounded-full bg-zinc-800 text-zinc-400 hover:text-white active:scale-90 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="space-y-1">
                  <h3 className="text-sm font-extrabold flex items-center space-x-1.5 text-white">
                    <Users className="w-4 h-4 text-yellow-400" />
                    <span>Add Guardian to Circle</span>
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Select a group or create a new circle category.
                  </p>
                </div>

                {/* 3 Main Group Options + Add Group Option */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">
                    Target Guardian Group
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {allGroups.map((g) => (
                      <button
                        key={g.key}
                        type="button"
                        onClick={() => setSelectedGroup(g.key)}
                        className={`p-2.5 rounded-xl text-xs font-black text-left border transition-all ${
                          selectedGroup === g.key
                            ? "bg-yellow-400 text-black border-yellow-400 shadow-sm"
                            : "bg-black/50 text-zinc-300 border-zinc-800 hover:border-zinc-700"
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}

                    {/* Add Custom Group Option Button */}
                    <button
                      type="button"
                      onClick={() => setShowCustomGroupField(!showCustomGroupField)}
                      className="p-2.5 rounded-xl text-xs font-black text-left border border-dashed border-zinc-700 text-yellow-400 bg-yellow-400/10 hover:bg-yellow-400/20 flex items-center space-x-1"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                      <span>+ Add Group</span>
                    </button>
                  </div>
                </div>

                {/* Custom Group Input Field */}
                {showCustomGroupField && (
                  <div className="flex items-center space-x-2 pt-1 animate-in fade-in">
                    <input
                      type="text"
                      placeholder="New group name (e.g. Neighbors)"
                      value={customGroupInput}
                      onChange={(e) => setCustomGroupInput(e.target.value)}
                      className="flex-1 bg-black border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-yellow-400"
                    />
                    <button
                      type="button"
                      onClick={handleCreateCustomGroup}
                      className="bg-yellow-400 text-black font-extrabold px-3 py-2 rounded-xl text-xs"
                    >
                      Add
                    </button>
                  </div>
                )}

                {/* Import Phone Contacts or Manual Form */}
                <div className="space-y-3 pt-2 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={handleAutoPickContacts}
                    disabled={importing}
                    className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-extrabold py-3 rounded-2xl text-xs flex items-center justify-center space-x-2 active:scale-95 transition-all shadow-md shadow-yellow-400/20"
                  >
                    {importing ? (
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                    ) : (
                      <>
                        <Users className="w-4 h-4" />
                        <span>Import Phone Contact to {selectedGroup}</span>
                      </>
                    )}
                  </button>

                  <form onSubmit={submitManualWithGroup} className="space-y-2.5 pt-2">
                    <input
                      type="text"
                      required
                      placeholder="Guardian Name"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-yellow-400"
                    />
                    <input
                      type="tel"
                      required
                      placeholder="Phone (+233...)"
                      value={manualPhone}
                      onChange={(e) => setManualPhone(e.target.value)}
                      className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-yellow-400"
                    />
                    <button
                      type="submit"
                      disabled={addingContact}
                      className="w-full bg-white text-black font-black py-3 rounded-xl text-xs flex items-center justify-center space-x-1.5 active:scale-95 transition-all"
                    >
                      {addingContact ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <span>Save to {selectedGroup}</span>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}
        </>
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

          {/* SHARED SESSION DETAIL MODAL */}
          {activeDetailSession && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md p-4 flex items-center justify-center animate-in fade-in">
              <div className="bg-zinc-900 text-white border border-zinc-800 rounded-4xl p-6 w-full max-w-sm space-y-5 relative shadow-2xl">
                <button
                  onClick={() => setActiveDetailSession(null)}
                  className="absolute top-4 right-4 p-2 rounded-full bg-zinc-800 text-zinc-400 hover:text-white active:scale-90 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>

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

                {activeDetailSession.notes && (
                  <div className="bg-zinc-800/80 border border-zinc-700/60 p-3.5 rounded-2xl text-xs space-y-1">
                    <p className="text-[10px] font-black uppercase text-zinc-400">Guardian Note</p>
                    <p className="text-zinc-200">{activeDetailSession.notes}</p>
                  </div>
                )}

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