"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Radio,
  Loader2,
  Clock,
  ShieldAlert,
  Phone,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  MapPin,
  Users,
  MessageSquare,
  Navigation,
  Plus,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { SatelliteMap } from "../ui/satellite-map";
import { cleanPhone } from "@/lib/utils";

export interface Contact {
  id: string;
  name: string;
  phone: string;
  group_category?: string;
  isLociUser?: boolean;
  avatar_url?: string;
}

export interface SharedSession {
  id: string;
  user_id?: string;
  user_phone: string;
  destination: string;
  expected_arrival_at: string;
  status: "active" | "completed" | "missed" | "escalated" | "expired";
  user_reminder_mins?: number;
  contact_reminder_mins?: number;
  last_user_checkin_at?: string;
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

function formatCountdown(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function getSessionParticipantNames(session: SharedSession, contacts: Contact[], userPhone: string, ownerName: string) {
  const row = session as Record<string, unknown>;
  const storedParticipants = row.participants ?? row.shared_with ?? row.guardian_phones;
  const values = Array.isArray(storedParticipants) ? storedParticipants : [];
  const names = values.map((participant) => {
    if (typeof participant === "string") {
      return contacts.find((contact) => cleanPhone(contact.phone) === cleanPhone(participant))?.name || participant;
    }
    if (participant && typeof participant === "object") {
      const detail = participant as Record<string, unknown>;
      const phone = typeof detail.phone === "string" ? detail.phone : "";
      return (typeof detail.name === "string" && detail.name)
        || contacts.find((contact) => cleanPhone(contact.phone) === cleanPhone(phone))?.name
        || phone;
    }
    return "";
  });

  return Array.from(new Set([cleanPhone(session.user_phone) === cleanPhone(userPhone) ? "You" : ownerName, ...names].filter(Boolean)));
}

interface SharedSessionsPageProps {
  userPhone: string;
  currentUserId: string | null;
  contacts: Contact[];
  openSessionId?: string | null;
  onSessionOpened?: () => void;
}

export function SharedSessionsPage({
  userPhone,
  currentUserId,
  contacts,
  openSessionId,
  onSessionOpened,
}: SharedSessionsPageProps) {
  const [sharedSessions, setSharedSessions] = useState<SharedSession[]>([]);
  const [historySessions, setHistorySessions] = useState<SharedSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [activeDetailSession, setActiveDetailSession] = useState<SharedSession | null>(null);
  const [guardianPhones, setGuardianPhones] = useState<string[]>([]);
  const [detailNow, setDetailNow] = useState(0);
  const [shareFeedback, setShareFeedback] = useState("");
  const mapSectionRef = useRef<HTMLDivElement>(null);
  const activeDetailSessionId = activeDetailSession?.id;

  useEffect(() => {
    const timer = window.setInterval(() => setDetailNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!activeDetailSessionId) return;
    let cancelled = false;
    void supabase
      .from("session_recipients")
      .select("recipient_phone")
      .eq("session_id", activeDetailSessionId)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to load session guardians:", error);
          return;
        }
        setGuardianPhones([...new Set((data || []).map((recipient) => recipient.recipient_phone))]);
      });
    return () => { cancelled = true; };
  }, [activeDetailSessionId]);

  const fetchSharedSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const contactPhones = new Set(contacts.map((contact) => cleanPhone(contact.phone)).filter(Boolean));
      const currentUserPhone = cleanPhone(userPhone);
      const [activeResponse, historyResponse, recipientsResponse] = await Promise.all([
        supabase
          .from("checkin_sessions")
          .select("*")
          .eq("status", "active")
          .order("created_at", { ascending: false }),
        supabase
          .from("checkin_sessions")
          .select("*")
          .neq("status", "active")
          .order("created_at", { ascending: false }),
        supabase
          .from("session_recipients")
          .select("session_id, recipient_phone, contact_phone"),
      ]);

      if (activeResponse.error) console.error("Error fetching active shared sessions:", activeResponse.error);
      if (historyResponse.error) console.error("Error fetching session history:", historyResponse.error);
      if (recipientsResponse.error) console.error("Error fetching session recipients:", recipientsResponse.error);

      const matchedRecipientIds = new Set((recipientsResponse.data || [])
        .filter((row) => cleanPhone(row.recipient_phone) === currentUserPhone || cleanPhone(row.contact_phone) === currentUserPhone)
        .map((row) => row.session_id));

      const activeRows = (activeResponse.data || []).filter((session) => {
        const ownerPhone = cleanPhone(session.user_phone);
        const isOwner = !!currentUserId && session.user_id === currentUserId;
        return isOwner || (ownerPhone !== currentUserPhone && (contactPhones.has(ownerPhone) || matchedRecipientIds.has(session.id)));
      });

      const historyById = new Map<string, Record<string, unknown>>();
      for (const session of historyResponse.data || []) {
        if (session.status !== "active" && cleanPhone(session.user_phone) === currentUserPhone) {
          historyById.set(session.id, session);
        }
        if (session.status !== "active" && matchedRecipientIds.has(session.id)) {
          historyById.set(session.id, session);
        }
      }
      const historyRows = Array.from(historyById.values());
      const sessionRows = [...activeRows, ...historyRows];
      const senderPhones = Array.from(new Set(sessionRows.map((session) => session.user_phone as string)));

      const { data: usersData } = await supabase
        .from("users")
        .select("phone, nickname, full_name, avatar_url")
        .in("phone", senderPhones.length > 0 ? senderPhones : ["none"]);

      const formatSession = (session: Record<string, unknown>) => {
        const matchedUser = usersData?.find((user) => cleanPhone(user.phone) === cleanPhone(String(session.user_phone || "")));
        return {
          ...session,
          user: matchedUser
            ? { nickname: matchedUser.nickname, full_name: matchedUser.full_name, avatar_url: matchedUser.avatar_url }
            : undefined,
        } as unknown as SharedSession;
      };

      const formattedActive = activeRows.map(formatSession);
      const formattedHistory = historyRows.map(formatSession);
      setSharedSessions(formattedActive);
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
  }, [contacts, currentUserId, userPhone]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => void fetchSharedSessions(), 0);

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
      window.clearTimeout(loadTimer);
      supabase.removeChannel(channel);
    };
  }, [fetchSharedSessions]);

  useEffect(() => {
    if (!openSessionId) return;
    const targetSession = sharedSessions.find((session) => session.id === openSessionId);
    if (!targetSession) return;
    const openTimer = window.setTimeout(() => {
      setActiveDetailSession(targetSession);
      onSessionOpened?.();
    }, 0);
    return () => window.clearTimeout(openTimer);
  }, [openSessionId, onSessionOpened, sharedSessions]);

  const activeDetailCoordinates = activeDetailSession
    ? getSessionCoordinates(activeDetailSession)
    : null;

  const confirmSafe = async (session: SharedSession) => {
    const checkedInAt = new Date().toISOString();
    const { error } = await supabase
      .from("checkin_sessions")
      .update({ last_user_checkin_at: checkedInAt })
      .eq("id", session.id)
      .eq("status", "active");
    if (error) {
      console.error("Failed to record safety check-in:", error);
      return;
    }
    setActiveDetailSession({ ...session, last_user_checkin_at: checkedInAt });
  };

  const extendSession = async (session: SharedSession) => {
    const newArrival = new Date(Math.max(Date.now(), new Date(session.expected_arrival_at).getTime()) + 15 * 60000).toISOString();
    const { error } = await supabase
      .from("checkin_sessions")
      .update({ expected_arrival_at: newArrival })
      .eq("id", session.id)
      .eq("status", "active");
    if (error) {
      console.error("Failed to extend safety session:", error);
      return;
    }
    setActiveDetailSession({ ...session, expected_arrival_at: newArrival });
  };

  const endSession = async (session: SharedSession) => {
    const { error } = await supabase
      .from("checkin_sessions")
      .update({ status: "completed" })
      .eq("id", session.id)
      .eq("status", "active");
    if (error) {
      console.error("Failed to end safety session:", error);
      return;
    }
    setActiveDetailSession({ ...session, status: "completed" });
  };

  const shareEmergencyDetails = async (session: SharedSession, ownerName: string) => {
    const details = `${ownerName} is on a Déloci safety session. Destination: ${session.destination}. Expected arrival: ${new Date(session.expected_arrival_at).toLocaleString()}. Phone: ${session.user_phone}.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${ownerName}'s safety session`, text: details });
      } else {
        await navigator.clipboard.writeText(details);
        setShareFeedback("Emergency details copied");
        window.setTimeout(() => setShareFeedback(""), 2500);
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        console.error("Could not share emergency details:", error);
      }
    }
  };

  // FULL PAGE VIEW (COMPACT CARDS)
  if (activeDetailSession) {
    const ownerName = activeDetailSession.user?.nickname ||
      activeDetailSession.user?.full_name ||
      contacts.find((c) => cleanPhone(c.phone) === cleanPhone(activeDetailSession.user_phone))?.name ||
      "Circle Friend";
    const isSender = !!currentUserId && activeDetailSession.user_id === currentUserId;
    const expectedArrivalMs = new Date(activeDetailSession.expected_arrival_at).getTime();
    const lastCheckinMs = new Date(activeDetailSession.last_user_checkin_at || activeDetailSession.created_at).getTime();
    const isOverdue = activeDetailSession.status === "missed" ||
      activeDetailSession.status === "escalated" ||
      (activeDetailSession.status === "active" && detailNow > 0 && (
        detailNow >= expectedArrivalMs + (activeDetailSession.contact_reminder_mins || 30) * 60000 ||
        detailNow >= lastCheckinMs + (activeDetailSession.user_reminder_mins || 15) * 60000
      ));
    const statusLabel = activeDetailSession.status === "completed"
      ? "SAFE"
      : isOverdue
        ? "OVERDUE / MISSED CHECK-IN"
        : "ACTIVE";
    const countdownSeconds = detailNow > 0 ? Math.max(0, Math.floor((expectedArrivalMs - detailNow) / 1000)) : 0;
    const activeGuardians = contacts.filter((contact) => guardianPhones.includes(contact.phone));

    return (
      <div className="space-y-3.5 animate-in fade-in slide-in-from-right-4 min-h-[80vh] pb-8">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setActiveDetailSession(null)}
            className="p-2 rounded-full bg-zinc-200/60 dark:bg-zinc-900/60 backdrop-blur-xl text-black dark:text-white active:scale-90 transition-all shadow-xs flex items-center space-x-1 pr-3 border border-zinc-300/40 dark:border-zinc-800"
          >
            <ChevronLeft className="w-3.5 h-3.5 stroke-[2.5]" />
            <span className="text-[11px] font-bold">Back to Shared Feeds</span>
          </button>

          <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${statusLabel === "SAFE" ? "bg-emerald-500 text-white" : isOverdue ? "bg-red-600 text-white" : "bg-yellow-400 text-black"}`}>
            <Radio className="w-3 h-3 animate-pulse" />
            <span>{statusLabel}</span>
          </span>
        </div>

        {/* Sender Profile Header */}
        <div className="bg-zinc-900 text-white p-3.5 rounded-2xl border border-zinc-800 relative overflow-hidden flex items-center justify-between shadow-md">
          <div className="flex items-center space-x-3 relative z-10">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-yellow-400 text-black font-black text-base flex items-center justify-center uppercase border border-yellow-300 shadow-xs shrink-0">
              {activeDetailSession.user?.avatar_url ? (
                <img src={activeDetailSession.user.avatar_url} alt={`${ownerName}'s profile`} className="w-full h-full object-cover" />
              ) : (
                ownerName.slice(0, 2)
              )}
            </div>
            <div>
              <span className="text-[9px] font-black uppercase text-yellow-400 tracking-wider">
                {isSender ? "Sender View" : "Guardian View"}
              </span>
              <h3 className="text-base font-black text-white leading-tight">
                {isSender ? "Your Active Safety Watch" : `Monitoring ${ownerName}'s Journey`}
              </h3>
              {!isSender && <p className="text-[10px] font-mono text-zinc-400">{activeDetailSession.user_phone}</p>}
            </div>
          </div>

        </div>

        {/* Destination & ETA Info Card */}
        <div className="bg-yellow-400 text-black rounded-2xl p-3.5 space-y-2.5 shadow-md">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center space-x-1 text-[8px] font-black uppercase bg-black text-yellow-400 px-2 py-0.5 rounded-full">
              <Sparkles className="w-3 h-3 text-yellow-400" />
              <span>Target Location</span>
            </span>
            <Clock className="w-4 h-4 text-black" />
          </div>

          <div>
            <p className="text-[8px] font-black uppercase text-black/60 tracking-wider">Heading To</p>
            <h4 className="text-lg font-black leading-tight mt-0.5">{activeDetailSession.destination}</h4>
          </div>

          <div className="bg-black/10 p-2.5 rounded-xl flex items-center justify-between border border-black/10">
            <div>
              <p className="text-[8px] font-bold uppercase text-black/70">Expected Arrival Time</p>
              <p className="text-xs font-black font-mono">
                {new Date(activeDetailSession.expected_arrival_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <ShieldAlert className="w-4 h-4 text-black" />
          </div>
        </div>

        {isSender && activeDetailSession.status === "active" && (
          <section className="space-y-3 rounded-2xl border border-yellow-400/50 bg-yellow-400/10 p-4">
            <div className="text-center">
              <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Time until expected arrival</p>
              <p className="font-mono text-4xl font-black text-yellow-500" aria-live="polite">
                {countdownSeconds > 0 ? formatCountdown(countdownSeconds) : "OVERDUE"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void confirmSafe(activeDetailSession)}
              className="w-full rounded-xl bg-yellow-400 py-3.5 text-sm font-black text-black active:scale-[0.98]"
            >
              Confirm I’m Safe
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void extendSession(activeDetailSession)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-300 dark:border-zinc-700 py-3 text-xs font-bold text-black dark:text-white"
              >
                <Plus className="h-4 w-4" /> Extend 15 min
              </button>
              <button
                type="button"
                onClick={() => void endSession(activeDetailSession)}
                className="rounded-xl bg-red-600 py-3 text-xs font-bold text-white"
              >
                End Session
              </button>
            </div>
          </section>
        )}

        {/* Live Map Frame */}
        <div ref={mapSectionRef} className="space-y-1.5 scroll-mt-4">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center space-x-1">
              <MapPin className="w-3 h-3 text-yellow-400" />
              <span>Live Location Tracking</span>
            </h4>
            {activeDetailCoordinates && (
              <span className="text-[9px] font-mono text-emerald-500 font-extrabold flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                <span>GPS Connected</span>
              </span>
            )}
          </div>

          {activeDetailCoordinates ? (
            <div className="rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <SatelliteMap
                latitude={activeDetailCoordinates.latitude}
                longitude={activeDetailCoordinates.longitude}
                className="h-48 w-full"
              />
            </div>
          ) : (
            <div className="h-36 rounded-2xl bg-zinc-200/60 dark:bg-zinc-900/60 border border-zinc-300/40 dark:border-zinc-800 flex flex-col items-center justify-center p-3 text-center space-y-1.5">
              <Navigation className="w-6 h-6 text-zinc-400 animate-bounce" />
              <p className="text-[11px] font-bold text-zinc-500">Waiting for friend&apos;s GPS updates...</p>
            </div>
          )}
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/50 dark:border-zinc-800/50 rounded-xl p-2.5 space-y-0.5">
            <p className="text-[9px] font-black uppercase text-zinc-400">Started</p>
            <p className="font-extrabold text-[11px] text-black dark:text-white">
              {new Date(activeDetailSession.created_at).toLocaleString([], {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>

          <div className="bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/50 dark:border-zinc-800/50 rounded-xl p-2.5 space-y-0.5">
            <p className="text-[9px] font-black uppercase text-zinc-400">Duration</p>
            <p className="font-extrabold text-[11px] text-black dark:text-white">
              {formatSessionDuration(activeDetailSession.created_at, activeDetailSession.expected_arrival_at)}
            </p>
          </div>
        </div>

        {isSender ? (
          <section className="space-y-2 rounded-xl border border-zinc-200/70 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 p-3">
            <h4 className="flex items-center gap-2 text-xs font-black text-black dark:text-white">
              <Users className="h-4 w-4 text-yellow-400" /> Guardians receiving this watch
            </h4>
            {activeGuardians.length > 0 ? (
              <ul className="space-y-1.5">
                {activeGuardians.map((guardian) => (
                  <li key={guardian.id} className="flex items-center justify-between text-xs">
                    <span className="font-bold text-black dark:text-white">{guardian.name}</span>
                    <span className="font-mono text-zinc-500">{guardian.phone}</span>
                  </li>
                ))}
              </ul>
            ) : guardianPhones.length > 0 ? (
              <ul className="space-y-1.5">
                {guardianPhones.map((phone) => <li key={phone} className="font-mono text-xs text-zinc-500">{phone}</li>)}
              </ul>
            ) : (
              <p className="text-[11px] text-zinc-500">No guardians are attached to this session.</p>
            )}
          </section>
        ) : (
          <div className="bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/50 dark:border-zinc-800/50 p-2.5 rounded-xl text-xs space-y-1">
            <p className="text-[9px] font-black uppercase text-zinc-400 flex items-center space-x-1">
              <Users className="w-3 h-3 text-yellow-400" />
              <span>Shared Participants</span>
            </p>
            <p className="font-semibold text-[11px] text-black dark:text-white">
              {getSessionParticipantNames(activeDetailSession, contacts, userPhone, ownerName).join(", ")}
            </p>
          </div>
        )}

        {/* Guardian Note */}
        {activeDetailSession.notes && (
          <div className="bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/50 dark:border-zinc-800/50 p-2.5 rounded-xl text-xs space-y-1">
            <p className="text-[9px] font-black uppercase text-zinc-400 flex items-center space-x-1">
              <MessageSquare className="w-3 h-3 text-yellow-400" />
              <span>Guardian Note</span>
            </p>
            <p className="text-zinc-700 dark:text-zinc-200 font-medium text-[11px]">{activeDetailSession.notes}</p>
          </div>
        )}

        {!isSender && (
          <section className="space-y-2">
            <a
              href={`tel:${activeDetailSession.user_phone}`}
              className="w-full bg-black dark:bg-white text-white dark:text-black font-black py-3.5 rounded-xl text-xs flex items-center justify-center space-x-2 active:scale-95 transition-all shadow-md"
            >
              <Phone className="w-4 h-4 fill-current" />
              <span>Call {ownerName}</span>
            </a>
            <button
              type="button"
              onClick={() => void shareEmergencyDetails(activeDetailSession, ownerName)}
              className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-3.5 text-xs font-black text-black dark:text-white"
            >
              Share Emergency Details
            </button>
            {shareFeedback && <p role="status" className="text-center text-[11px] font-bold text-emerald-600">{shareFeedback}</p>}
            <button
              type="button"
              onClick={() => mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="w-full rounded-xl bg-yellow-400 py-3.5 text-xs font-black text-black"
            >
              View Last Known GPS Location
            </button>
          </section>
        )}
      </div>
    );
  }

  // LIST VIEW (COMPACT CARDS)
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-black text-black dark:text-white">Shared Feeds 📡</h2>
        <p className="text-[10px] text-zinc-400">
          Live journey sessions shared with you by your circle.
        </p>
      </div>

      {sessionsLoading ? (
        <div className="py-8 flex justify-center items-center">
          <Loader2 className="w-5 h-5 animate-spin text-yellow-500" />
        </div>
      ) : sharedSessions.length === 0 ? (
        <div className="text-center py-8 px-4 bg-white/60 dark:bg-zinc-900/40 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl space-y-1.5">
          <Radio className="w-6 h-6 text-zinc-400 mx-auto" />
          <p className="text-xs font-extrabold text-black dark:text-white">No Active Shared Sessions</p>
          <p className="text-[10px] text-zinc-400 max-w-xs mx-auto">
            When contacts in your circle start a session, their live updates appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sharedSessions.map((s) => {
            const displayName =
              s.user?.nickname ||
              s.user?.full_name ||
              contacts.find((c) => cleanPhone(c.phone) === cleanPhone(s.user_phone))?.name ||
              (cleanPhone(s.user_phone) === cleanPhone(userPhone) ? "You" : s.user_phone);
            const timestamp = new Date(s.created_at);

            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveDetailSession(s)}
                className="w-full bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/50 dark:border-zinc-800/50 p-2.5 px-3 rounded-xl shadow-xs flex items-center justify-between gap-2.5 text-left cursor-pointer hover:border-yellow-400/50 active:scale-[0.99] transition-all group"
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="relative shrink-0">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-900 text-yellow-400 font-black text-xs flex items-center justify-center uppercase border border-yellow-400">
                      {s.user?.avatar_url ? (
                        <img src={s.user.avatar_url} alt={`${displayName}'s profile`} className="w-full h-full object-cover" />
                      ) : (
                        displayName.slice(0, 2)
                      )}
                    </div>
                    <span className="w-2 h-2 bg-emerald-500 border border-white dark:border-black rounded-full absolute bottom-0 right-0 animate-ping" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-[11px] font-extrabold text-black dark:text-white truncate">{displayName}</span>
                      <span className="text-[8px] font-black uppercase bg-yellow-400 text-black px-1.5 py-0.2 rounded-full shrink-0">LIVE</span>
                    </div>
                    <p className="text-[10px] text-zinc-600 dark:text-zinc-300 font-semibold truncate">{s.destination}</p>
                    <p className="text-[9px] text-zinc-400">
                      {Number.isNaN(timestamp.getTime()) ? "Recently" : timestamp.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-black dark:group-hover:text-white transition-colors shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      {/* History Section */}
      <section className="space-y-2 pt-1">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-black text-black dark:text-white">Recents &amp; History</h3>
          <span className="text-[9px] font-bold text-zinc-400">{historySessions.length}</span>
        </div>
        {historySessions.length === 0 ? (
          <p className="text-[10px] text-zinc-400 px-1">Completed and expired sessions will appear here.</p>
        ) : (
          <div className="space-y-1.5">
            {historySessions.map((session) => {
              const displayName = session.user?.nickname
                || session.user?.full_name
                || contacts.find((contact) => cleanPhone(contact.phone) === cleanPhone(session.user_phone))?.name
                || (cleanPhone(session.user_phone) === cleanPhone(userPhone) ? "You" : session.user_phone);
              const expired = session.status === "active" || session.status === "missed" || session.status === "expired";
              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => setActiveDetailSession(session)}
                  className="w-full bg-white/80 dark:bg-zinc-900/70 border border-zinc-200/50 dark:border-zinc-800/50 p-2.5 px-3 rounded-xl flex items-center justify-between text-left hover:border-yellow-400/50 transition-colors"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="text-[11px] font-extrabold text-black dark:text-white truncate">{displayName}</span>
                      <span className={`text-[8px] font-black uppercase px-1.5 py-0.2 rounded-full ${expired ? "bg-red-500/15 text-red-500" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500"}`}>
                        {expired ? "Expired" : session.status}
                      </span>
                    </span>
                    <span className="block text-[10px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">{session.destination}</span>
                    <span className="block text-[9px] text-zinc-400">
                      {new Date(session.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-400 shrink-0 ml-2" />
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}