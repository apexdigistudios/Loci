"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Users,
  Radio,
  Plus,
  Trash2,
  Loader2,
  Clock,
  ShieldAlert,
  MapPin,
  X,
  Phone,
  Sparkles,
  ChevronRight,
  Shield,
  Heart,
  UserCheck,
  ChevronLeft,
  FolderPlus,
  Image as ImageIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { SatelliteMap } from "../ui/satellite-map";

export interface Contact {
  id: string;
  name: string;
  phone: string;
  group_category?: string;
  isLociUser?: boolean;
  avatar_url?: string;
}

interface SharedSession {
  id: string;
  user_phone: string;
  destination: string;
  expected_arrival_at: string;
  status: "active" | "completed" | "missed" | "escalated" | "expired";
  notes?: string;
  media_url?: string;
  created_at: string;
  [key: string]: unknown;
  user?: {
    nickname?: string;
    full_name?: string;
    avatar_url?: string;
  };
}

function getSessionCoordinates(session: SharedSession) {
  const row = session as Record<string, unknown>;
  const locationValue = row.location ?? row.last_location ?? row.location_coords ?? row.last_reported_location;
  const location = locationValue && typeof locationValue === "object"
    ? locationValue as Record<string, unknown>
    : {};
  const readCoordinate = (...values: unknown[]) => {
    const value = values.find((candidate) => candidate !== undefined && candidate !== null && candidate !== "");
    const coordinate = typeof value === "number" ? value : Number(value);
    return Number.isFinite(coordinate) ? coordinate : null;
  };
  const geoJsonCoordinates = Array.isArray(location.coordinates) ? location.coordinates : [];
  const latitude = readCoordinate(row.current_lat, row.latitude, row.lat, row.location_latitude, row.last_latitude, location.latitude, location.lat, geoJsonCoordinates[1]);
  const longitude = readCoordinate(row.current_lng, row.longitude, row.lng, row.location_longitude, row.last_longitude, location.longitude, location.lng, geoJsonCoordinates[0]);

  return latitude !== null && longitude !== null && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
    ? { latitude, longitude }
    : null;
}

function formatSessionDuration(startedAt: string, expectedArrivalAt: string) {
  const totalMinutes = Math.max(0, Math.round((new Date(expectedArrivalAt).getTime() - new Date(startedAt).getTime()) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function getSessionParticipantNames(session: SharedSession, contacts: Contact[], userPhone: string, ownerName: string) {
  const row = session as Record<string, unknown>;
  const storedParticipants = row.participants ?? row.shared_with ?? row.guardian_phones;
  const values = Array.isArray(storedParticipants) ? storedParticipants : [];
  const names = values.map((participant) => {
    if (typeof participant === "string") {
      return contacts.find((contact) => contact.phone === participant)?.name || participant;
    }
    if (participant && typeof participant === "object") {
      const detail = participant as Record<string, unknown>;
      const phone = typeof detail.phone === "string" ? detail.phone : "";
      return (typeof detail.name === "string" && detail.name)
        || contacts.find((contact) => contact.phone === phone)?.name
        || phone;
    }
    return "";
  });

  return Array.from(new Set([session.user_phone === userPhone ? "You" : ownerName, ...names].filter(Boolean)));
}

interface CustomGroup {
  key: string;
  label: string;
  desc: string;
  imageUrl?: string;
}

interface ContactsPageProps {
  userPhone: string;
  openSessionId?: string | null;
  onSessionOpened?: () => void;
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
    image: "/pages/emergency.png",
    accent: "bg-zinc-900 border-red-500/40 text-red-400",
    badgeBg: "bg-black/60 backdrop-blur-md text-red-300 border-red-500/40",
    desc: "First responders & primary emergency guardians",
    isDefault: true,
  },
  {
    key: "Family",
    label: "Family",
    image: "/pages/family.png",
    accent: "bg-zinc-900 border-yellow-400/40 text-yellow-400",
    badgeBg: "bg-black/60 backdrop-blur-md text-yellow-300 border-yellow-400/40",
    desc: "Parents, siblings & immediate family",
    isDefault: true,
  },
  {
    key: "Besties",
    label: "Besties",
    image: "/pages/besties.png",
    accent: "bg-zinc-900 border-zinc-700/60 text-zinc-200",
    badgeBg: "bg-black/60 backdrop-blur-md text-zinc-300 border-zinc-700",
    desc: "Close friends, roommates & ride partners",
    isDefault: true,
  },
];

export function ContactsPage({
  userPhone,
  openSessionId,
  onSessionOpened,
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
  const [subTab, setSubTab] = useState<"contacts" | "shared">(() => openSessionId ? "shared" : "contacts");
  const [activeGroupView, setActiveGroupView] = useState<string | null>(null);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string>("Emergency Circle");
  const [customGroupInput, setCustomGroupInput] = useState("");
  const [customGroupImage, setCustomGroupImage] = useState<string | null>(null);
  const [showCustomGroupField, setShowCustomGroupField] = useState(false);

  // Persistent Custom Groups State
  const [customGroups, setCustomGroups] = useState<CustomGroup[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("loci_custom_groups");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error("Failed to parse saved custom groups", e);
        }
      }
    }
    return [];
  });

  const [importError, setImportError] = useState(false);
  const [importing, setImporting] = useState(false);

  // Shared Sessions State
  const [sharedSessions, setSharedSessions] = useState<SharedSession[]>([]);
  const [historySessions, setHistorySessions] = useState<SharedSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [activeDetailSession, setActiveDetailSession] = useState<SharedSession | null>(null);

  const groupImageInputRef = useRef<HTMLInputElement>(null);

  const fetchSharedSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const participantPhones = [...new Set(contacts.map((contact) => contact.phone).filter((phone) => phone !== userPhone))];
      const [activeResponse, ownHistoryResponse, recipientResponse, contactResponse] = await Promise.all([
        participantPhones.length > 0
          ? supabase
              .from("checkin_sessions")
              .select("*")
              .in("user_phone", participantPhones)
              .neq("user_phone", userPhone)
              .eq("status", "active")
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("checkin_sessions")
          .select("*")
          .eq("user_phone", userPhone)
          .neq("status", "active")
          .order("created_at", { ascending: false }),
        supabase
          .from("session_recipients")
          .select("session_id")
          .eq("recipient_phone", userPhone),
        supabase
          .from("session_recipients")
          .select("session_id")
          .eq("contact_phone", userPhone),
      ]);

      if (activeResponse.error) console.error("Error fetching active shared sessions:", activeResponse.error);
      if (ownHistoryResponse.error) console.error("Error fetching own session history:", ownHistoryResponse.error);
      if (recipientResponse.error) console.error("Error fetching recipient session links:", recipientResponse.error);
      if (contactResponse.error) console.error("Error fetching contact session links:", contactResponse.error);

      const linkedSessionIds = Array.from(new Set([
        ...(recipientResponse.data || []).map((row) => row.session_id),
        ...(contactResponse.data || []).map((row) => row.session_id),
      ].filter((id): id is string => !!id)));

      const { data: linkedHistoryRows, error: linkedHistoryError } = linkedSessionIds.length > 0
        ? await supabase
            .from("checkin_sessions")
            .select("*")
            .in("id", linkedSessionIds)
            .neq("status", "active")
            .order("created_at", { ascending: false })
        : { data: [], error: null };

      if (linkedHistoryError) console.error("Error fetching linked session history:", linkedHistoryError);

      const activeRows = (activeResponse.data || []).filter((session) => session.user_phone !== userPhone);
      const historyById = new Map<string, Record<string, unknown>>();
      for (const session of [...(ownHistoryResponse.data || []), ...(linkedHistoryRows || [])]) {
        if (session.status !== "active") historyById.set(session.id, session);
      }
      const historyRows = Array.from(historyById.values());
      const sessionRows = [...activeRows, ...historyRows];
      const senderPhones = Array.from(new Set(sessionRows.map((session) => session.user_phone as string)));

      const { data: usersData } = await supabase
        .from("users")
        .select("phone, nickname, full_name, avatar_url")
        .in("phone", senderPhones.length > 0 ? senderPhones : ["none"]);

      const formatSession = (session: Record<string, unknown>) => {
        const matchedUser = usersData?.find((user) => user.phone === session.user_phone);
        return {
          ...session,
          user: matchedUser
            ? { nickname: matchedUser.nickname, full_name: matchedUser.full_name, avatar_url: matchedUser.avatar_url }
            : undefined,
        } as unknown as SharedSession;
      };
      const formattedActive = activeRows.map(formatSession);
      const formattedHistory = historyRows.map(formatSession);
      const now = Date.now();

      setSharedSessions(formattedActive.filter((session) =>
        new Date(session.expected_arrival_at).getTime() >= now
      ));
      setHistorySessions(formattedHistory);
      setActiveDetailSession((current) => current
        ? [...formattedActive, ...formattedHistory].find((session) => session.id === current.id) || current
        : null
      );
    } catch (err) {
      console.error("Error fetching shared sessions:", err);
    } finally {
      setSessionsLoading(false);
    }
  }, [contacts, userPhone]);

  useEffect(() => {
    fetchSharedSessions();

    const channel = supabase
      .channel("checkin_sessions_realtime_feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "checkin_sessions" },
        () => {
          fetchSharedSessions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSharedSessions]);

  useEffect(() => {
    if (!openSessionId) return;
    const targetSession = sharedSessions.find((session) => session.id === openSessionId);
    if (!targetSession) return;
    setActiveDetailSession(targetSession);
    onSessionOpened?.();
  }, [openSessionId, onSessionOpened, sharedSessions]);

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

  const handleGroupImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCustomGroupImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateCustomGroup = () => {
    if (!customGroupInput.trim()) return;
    const gName = customGroupInput.trim();

    if (!customGroups.some((cg) => cg.key === gName)) {
      const newGroup: CustomGroup = {
        key: gName,
        label: gName,
        desc: "Custom guardian group",
        imageUrl: customGroupImage || undefined,
      };
      const updated = [...customGroups, newGroup];
      setCustomGroups(updated);
      if (typeof window !== "undefined") {
        localStorage.setItem("loci_custom_groups", JSON.stringify(updated));
      }
    }

    setSelectedGroup(gName);
    setCustomGroupInput("");
    setCustomGroupImage(null);
    setShowCustomGroupField(false);
  };

  const handleDeleteCustomGroup = (groupKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customGroups.filter((cg) => cg.key !== groupKey);
    setCustomGroups(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("loci_custom_groups", JSON.stringify(updated));
    }
    if (activeGroupView === groupKey) {
      setActiveGroupView(null);
    }
  };

  const submitManualWithGroup = (e: React.FormEvent) => {
    e.preventDefault();
    handleAddManualContact(e, selectedGroup);
    setShowAddModal(false);
  };

  const allGroups = [
    ...DEFAULT_GROUPS,
    ...customGroups.map((cg) => ({
      key: cg.key,
      label: cg.label,
      image: cg.imageUrl || "",
      accent: "bg-zinc-900 border-zinc-700/60 text-zinc-200",
      badgeBg: "bg-black/60 backdrop-blur-md text-zinc-300 border-zinc-700",
      desc: cg.desc,
      isDefault: false,
    })),
  ];

  const activeGroupData = allGroups.find((g) => g.key === activeGroupView);

  const groupContacts = contacts.filter(
    (c) => (c.group_category || "Emergency Circle") === activeGroupView
  );
  const activeDetailCoordinates = activeDetailSession
    ? getSessionCoordinates(activeDetailSession)
    : null;

  return (
    <div className="space-y-5">
      {/* Top Control Bar */}
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
            <span className="w-2 h-2 rounded-full bg-yellow-400 absolute top-2 right-4 animate-ping" />
          )}
        </button>
      </div>

      {/* SUBVIEW 1: MY CIRCLE BENTO GRID & GROUPS */}
      {subTab === "contacts" && (
        <>
          {activeGroupView ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-2">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setActiveGroupView(null)}
                  className="p-2.5 rounded-full bg-zinc-200/60 dark:bg-zinc-900/60 backdrop-blur-xl text-black dark:text-white active:scale-90 transition-all shadow-sm flex items-center space-x-1 pr-3.5 border border-zinc-300/40 dark:border-zinc-800"
                >
                  <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                  <span className="text-xs font-bold">Groups</span>
                </button>

                <div className="flex items-center space-x-2">
                  {!activeGroupData?.isDefault && (
                    <button
                      onClick={(e) => handleDeleteCustomGroup(activeGroupView, e)}
                      className="p-2.5 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all active:scale-90 border border-red-500/30"
                      title="Delete Custom Group"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

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
              </div>

              {/* Header Image Card for Active Group */}
              <div className="bg-zinc-900 text-white p-5 rounded-[28px] border border-zinc-800 relative overflow-hidden flex flex-col justify-end min-h-36 shadow-lg">
                {activeGroupData?.image ? (
                  <img
                    src={activeGroupData.image}
                    alt={activeGroupData.label}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute top-0 right-0 p-6 opacity-10">
                    <Shield className="w-24 h-24 text-yellow-400" />
                  </div>
                )}
                <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

                <div className="relative z-10 space-y-0.5">
                  <span className="text-[10px] font-black uppercase text-yellow-400 tracking-wider">
                    Group Circle
                  </span>
                  <h3 className="text-xl font-extrabold text-white">{activeGroupView}</h3>
                  <p className="text-xs text-zinc-200">
                    {groupContacts.length} Linked Guardians in this circle
                  </p>
                </div>
              </div>

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
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-900 text-yellow-400 font-black text-xs flex items-center justify-center uppercase border border-yellow-400/40">
                          {c.isLociUser && c.avatar_url ? (
                            <img src={c.avatar_url} alt={`${c.name}'s profile`} className="w-full h-full object-cover" />
                          ) : (
                            c.name.slice(0, 2)
                          )}
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
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h2 className="text-base font-black text-black dark:text-white">My Circle 🛡️</h2>
                  <p className="text-[11px] text-zinc-400">
                    Organized guardian circles for instant safety dispatch.
                  </p>
                </div>

                <button
                  onClick={() => setShowAddModal(true)}
                  className="w-11 h-11 rounded-full bg-yellow-400 text-black flex items-center justify-center active:scale-90 transition-all shadow-lg shadow-yellow-400/20 border-2 border-yellow-300"
                  title="Add Guardian or Group"
                >
                  <Plus className="w-6 h-6 stroke-3" />
                </button>
              </div>

              {/* Bento Grid with Crisp Background Images & Clean Vignette Overlay */}
              <div className="grid grid-cols-2 gap-3">
                {allGroups.map((grp, idx) => {
                  const count = contacts.filter(
                    (c) => (c.group_category || "Emergency Circle") === grp.key
                  ).length;

                  const isWide = idx === 0;

                  return (
                    <div
                      key={grp.key}
                      onClick={() => setActiveGroupView(grp.key)}
                      className={`p-4 rounded-[26px] ${grp.accent} border relative overflow-hidden cursor-pointer active:scale-95 transition-all shadow-sm flex flex-col justify-between group ${
                        isWide ? "col-span-2 min-h-36" : "min-h-40"
                      }`}
                    >
                      {/* Background Image - Crisp and Clear */}
                      {grp.image && (
                        <img
                          src={grp.image}
                          alt={grp.label}
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 pointer-events-none"
                        />
                      )}
                      {/* Clean Bottom Gradient for Text Legibility without Blurring Image */}
                      <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/30 to-black/10 pointer-events-none" />

                      <div className="relative z-10 flex items-center justify-between">
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${grp.badgeBg}`}>
                          {count} Linked
                        </span>

                        {!grp.isDefault && (
                          <button
                            onClick={(e) => handleDeleteCustomGroup(grp.key, e)}
                            className="p-1.5 rounded-full bg-black/60 backdrop-blur-md text-zinc-300 hover:text-red-400 hover:bg-black/80 active:scale-90 transition-all border border-zinc-700/60"
                            title="Delete Custom Group"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="relative z-10 pt-4">
                        <h3 className="text-sm font-black text-white drop-shadow-md">{grp.label}</h3>
                        <p className="text-[10px] text-zinc-200 line-clamp-1 opacity-90 drop-shadow-md">
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
            <div className="fixed inset-0 z-100 bg-black/80 backdrop-blur-md p-4 flex items-center justify-center animate-in fade-in">
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

                {/* Custom Group Creation with Uploadable Image */}
                {showCustomGroupField && (
                  <div className="p-3 bg-black/60 border border-zinc-800 rounded-2xl space-y-2.5 animate-in fade-in">
                    <input
                      type="file"
                      ref={groupImageInputRef}
                      accept="image/*"
                      onChange={handleGroupImageUpload}
                      className="hidden"
                    />

                    <input
                      type="text"
                      placeholder="New group name (e.g. Neighbors)"
                      value={customGroupInput}
                      onChange={(e) => setCustomGroupInput(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-yellow-400"
                    />

                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => groupImageInputRef.current?.click()}
                        className="inline-flex items-center space-x-1.5 text-[11px] font-extrabold text-yellow-400 bg-yellow-400/10 px-3 py-1.5 rounded-lg border border-yellow-400/20 hover:bg-yellow-400/20 active:scale-95 transition-all"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>{customGroupImage ? "Change Image" : "Upload Card Image"}</span>
                      </button>

                      {customGroupImage && (
                        <span className="text-[10px] text-emerald-400 font-extrabold">
                          ✓ Image Attached
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleCreateCustomGroup}
                      className="w-full bg-yellow-400 text-black font-extrabold py-2 rounded-xl text-xs"
                    >
                      Create Group
                    </button>
                  </div>
                )}

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
                  (s.user_phone === userPhone ? "You" : s.user_phone);
                const timestamp = new Date(s.created_at);

                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveDetailSession(s)}
                    className="w-full bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/50 dark:border-zinc-800/50 p-4 rounded-[22px] shadow-sm flex items-center justify-between gap-3 text-left cursor-pointer hover:border-yellow-400/50 active:scale-[0.99] transition-all group"
                  >
                    <div className="flex items-center space-x-3.5 min-w-0">
                      <div className="relative shrink-0">
                        <div className="w-11 h-11 rounded-full overflow-hidden bg-zinc-900 text-yellow-400 font-black text-sm flex items-center justify-center uppercase border border-yellow-400">
                          {s.user?.avatar_url ? (
                            <img src={s.user.avatar_url} alt={`${displayName}'s profile`} className="w-full h-full object-cover" />
                          ) : (
                            displayName.slice(0, 2)
                          )}
                        </div>
                        <span className="w-3 h-3 bg-emerald-500 border-2 border-white dark:border-black rounded-full absolute bottom-0 right-0 animate-ping" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-xs font-extrabold text-black dark:text-white truncate">{displayName}</span>
                          <span className="text-[9px] font-black uppercase bg-yellow-400 text-black px-1.5 py-0.2 rounded-full shrink-0">LIVE</span>
                        </div>
                        <p className="text-[11px] text-zinc-600 dark:text-zinc-300 font-semibold truncate mt-0.5">{s.destination}</p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">
                          {Number.isNaN(timestamp.getTime()) ? "Recently" : timestamp.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-black dark:group-hover:text-white transition-colors shrink-0" />
                  </button>
                );
              })}
            </div>
          )}

          <section className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-black text-black dark:text-white">Recents &amp; History</h3>
              <span className="text-[10px] font-bold text-zinc-400">{historySessions.length}</span>
            </div>
            {historySessions.length === 0 ? (
              <p className="text-[11px] text-zinc-400 px-1">Completed and expired sessions will appear here.</p>
            ) : (
              <div className="space-y-2">
                {historySessions.map((session) => {
                  const displayName = session.user?.nickname
                    || session.user?.full_name
                    || contacts.find((contact) => contact.phone === session.user_phone)?.name
                    || (session.user_phone === userPhone ? "You" : session.user_phone);
                  const expired = session.status === "active" || session.status === "missed" || session.status === "expired";
                  return (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => setActiveDetailSession(session)}
                      className="w-full bg-white/80 dark:bg-zinc-900/70 border border-zinc-200/50 dark:border-zinc-800/50 p-3.5 rounded-2xl flex items-center justify-between text-left hover:border-yellow-400/50 transition-colors"
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-black dark:text-white truncate">{displayName}</span>
                          <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full ${expired ? "bg-red-500/15 text-red-500" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500"}`}>
                            {expired ? "Expired" : session.status}
                          </span>
                        </span>
                        <span className="block text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-1">{session.destination}</span>
                        <span className="block text-[10px] text-zinc-400 mt-0.5">
                          {new Date(session.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0 ml-3" />
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* SHARED SESSION DETAIL MODAL */}
          {activeDetailSession && (
            <div className="fixed inset-0 z-100 bg-black/80 backdrop-blur-md p-4 flex items-center justify-center animate-in fade-in">
              <div className="bg-zinc-900 text-white border border-zinc-800 rounded-4xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto space-y-5 relative shadow-2xl">
                <button
                  onClick={() => setActiveDetailSession(null)}
                  className="absolute top-4 right-4 p-2 rounded-full bg-zinc-800 text-zinc-400 hover:text-white active:scale-90 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex items-center space-x-3 pt-1">
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-yellow-400 text-black font-black text-lg flex items-center justify-center uppercase shadow-md shrink-0">
                    {activeDetailSession.user?.avatar_url ? (
                      <img src={activeDetailSession.user.avatar_url} alt="Session sender profile" className="w-full h-full object-cover" />
                    ) : (
                      (activeDetailSession.user?.nickname || contacts.find((c) => c.phone === activeDetailSession.user_phone)?.name || "ME").slice(0, 2)
                    )}
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
                      <span>{activeDetailSession.status === "active" ? "Live Journey Active" : `Session ${activeDetailSession.status}`}</span>
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

                {activeDetailCoordinates && (
                  <SatelliteMap
                    latitude={activeDetailCoordinates.latitude}
                    longitude={activeDetailCoordinates.longitude}
                    className="h-40 rounded-xl"
                  />
                )}

                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  <div className="bg-zinc-800/80 rounded-xl p-3">
                    <p className="text-[9px] font-black uppercase text-zinc-400">Session Started</p>
                    <p className="mt-1 font-semibold text-zinc-100">{new Date(activeDetailSession.created_at).toLocaleString()}</p>
                  </div>
                  <div className="bg-zinc-800/80 rounded-xl p-3">
                    <p className="text-[9px] font-black uppercase text-zinc-400">Duration</p>
                    <p className="mt-1 font-semibold text-zinc-100">
                      {formatSessionDuration(activeDetailSession.created_at, activeDetailSession.expected_arrival_at)}
                    </p>
                  </div>
                </div>

                <div className="bg-zinc-800/80 border border-zinc-700/60 p-3.5 rounded-2xl text-xs space-y-1">
                  <p className="text-[10px] font-black uppercase text-zinc-400">Participants</p>
                  <p className="text-zinc-200">
                    {getSessionParticipantNames(
                      activeDetailSession,
                      contacts,
                      userPhone,
                      activeDetailSession.user?.nickname || activeDetailSession.user?.full_name || "Circle Friend"
                    ).join(", ")}
                  </p>
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