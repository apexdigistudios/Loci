"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Radio,
  Loader2,
  Clock,
  ShieldAlert,
  Phone,
  ChevronRight,
  ChevronLeft,
  MapPin,
  Users,
  MessageSquare,
  Navigation,
  Plus,
  ExternalLink,
  CheckCircle2,
  XCircle,
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

function openInDeviceMaps(latitude: number, longitude: number) {
  const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const url = isIOS
    ? `https://maps.apple.com/?q=${latitude},${longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  window.open(url, "_blank");
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
  const [historyTab, setHistoryTab] = useState<"sent" | "received">("sent");
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
      const currentUserPhone = cleanPhone(userPhone);

      const { data: recipientData, error: recipErr } = await supabase
        .from("session_recipients")
        .select("session_id, recipient_phone, contact_phone");

      if (recipErr) console.error("Error fetching session recipients:", recipErr);

      const matchedRecipientIds = Array.from(
        new Set(
          (recipientData || [])
            .filter(
              (row) =>
                cleanPhone(row.recipient_phone) === currentUserPhone ||
                cleanPhone(row.contact_phone) === currentUserPhone
            )
            .map((row) => row.session_id)
            .filter(Boolean)
        )
      );

      const filters: string[] = [];
      if (currentUserId) {
        filters.push(`user_id.eq.${currentUserId}`);
      } else if (currentUserPhone) {
        filters.push(`user_phone.eq.${userPhone}`);
      }
      if (matchedRecipientIds.length > 0) {
        filters.push(`id.in.(${matchedRecipientIds.join(",")})`);
      }

      if (filters.length === 0) {
        setSharedSessions([]);
        setHistorySessions([]);
        setSessionsLoading(false);
        return;
      }

      const { data: sessionsData, error: sessionsErr } = await supabase
        .from("checkin_sessions")
        .select("*")
        .or(filters.join(","))
        .order("created_at", { ascending: false });

      if (sessionsErr) console.error("Error fetching sessions:", sessionsErr);

      const allSessions = sessionsData || [];

      const activeRows = allSessions.filter((s) => s.status === "active");
      const historyRows = allSessions.filter((s) => s.status !== "active");

      const senderPhones = Array.from(
        new Set(allSessions.map((session) => session.user_phone as string).filter(Boolean))
      );

      let usersData: Array<{ phone: string; nickname?: string; full_name?: string; avatar_url?: string }> = [];
      if (senderPhones.length > 0) {
        const { data: uData } = await supabase
          .from("users")
          .select("phone, nickname, full_name, avatar_url")
          .in("phone", senderPhones);
        usersData = uData || [];
      }

      const formatSession = (session: Record<string, unknown>) => {
        const matchedUser = usersData.find(
          (user) => cleanPhone(user.phone) === cleanPhone(String(session.user_phone || ""))
        );
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
      setActiveDetailSession((current) =>
        current
          ? [...formattedActive, ...formattedHistory].find((session) => session.id === current.id) || current
          : null
      );
    } catch (err) {
      console.error("Error fetching shared sessions:", err);
    } finally {
      setSessionsLoading(false);
    }
  }, [currentUserId, userPhone]);

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

  const isSessionSender = (session: SharedSession) => {
    if (currentUserId && session.user_id === currentUserId) return true;
    return cleanPhone(session.user_phone) === cleanPhone(userPhone);
  };

  const getSenderDisplayName = (session: SharedSession) => {
    if (isSessionSender(session)) return "You";
    return (
      session.user?.nickname ||
      session.user?.full_name ||
      contacts.find((c) => cleanPhone(c.phone) === cleanPhone(session.user_phone))?.name ||
      session.user_phone
    );
  };

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
    const details = `${ownerName} safety session. Destination: ${session.destination}. Expected arrival: ${new Date(session.expected_arrival_at).toLocaleString()}. Phone: ${session.user_phone}.`;
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

  const sentHistory = historySessions.filter((s) => isSessionSender(s));
  const receivedHistory = historySessions.filter((s) => !isSessionSender(s));

  if (activeDetailSession) {
    const isSender = isSessionSender(activeDetailSession);
    const ownerName = getSenderDisplayName(activeDetailSession);
    const isActive = activeDetailSession.status === "active";

    const expectedArrivalMs = new Date(activeDetailSession.expected_arrival_at).getTime();
    const lastCheckinMs = new Date(activeDetailSession.last_user_checkin_at || activeDetailSession.created_at).getTime();
    const isOverdue = isActive && (
      activeDetailSession.status === "missed" ||
      activeDetailSession.status === "escalated" ||
      (detailNow > 0 && (
        detailNow >= expectedArrivalMs + (activeDetailSession.contact_reminder_mins || 30) * 60000 ||
        detailNow >= lastCheckinMs + (activeDetailSession.user_reminder_mins || 15) * 60000
      ))
    );

    const getStatusLabel = () => {
      if (isActive) return isOverdue ? "OVERDUE" : "ACTIVE";
      if (activeDetailSession.status === "completed") return "COMPLETED";
      if (activeDetailSession.status === "expired" || activeDetailSession.status === "missed") return "EXPIRED";
      return activeDetailSession.status.toUpperCase();
    };

    const statusLabel = getStatusLabel();
    const countdownSeconds = detailNow > 0 ? Math.max(0, Math.floor((expectedArrivalMs - detailNow) / 1000)) : 0;
    const activeGuardians = contacts.filter((contact) => guardianPhones.includes(contact.phone));

    return (
      <div className="space-y-3.5 animate-in fade-in slide-in-from-right-4 min-h-[80vh] pb-8">
        {/* Header Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setActiveDetailSession(null)}
            className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white active:scale-95 transition-all flex items-center space-x-1 pr-3 border border-zinc-200 dark:border-zinc-700"
          >
            <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
            <span className="text-xs font-bold">Back to Feeds</span>
          </button>

          <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
            statusLabel === "ACTIVE"
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
              : statusLabel === "COMPLETED"
              ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
              : "bg-red-500/10 text-red-500 border border-red-500/20"
          }`}>
            {isActive && <Radio className="w-3 h-3 animate-pulse text-emerald-500" />}
            <span>{statusLabel}</span>
          </span>
        </div>

        {/* Profile / Context Card */}
        <div className="bg-zinc-900 text-white p-3.5 rounded-2xl border border-zinc-800 flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-xl overflow-hidden bg-zinc-800 text-yellow-400 font-bold text-sm flex items-center justify-center uppercase border border-zinc-700 shrink-0">
              {activeDetailSession.user?.avatar_url ? (
                <img src={activeDetailSession.user.avatar_url} alt={`${ownerName}'s profile`} className="w-full h-full object-cover" />
              ) : (
                ownerName.slice(0, 2)
              )}
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">
                {isSender ? "Sent Session" : "Received Session"}
              </span>
              <h3 className="text-sm font-bold text-white leading-tight">
                {isActive
                  ? isSender ? "Your Active Safety Watch" : `Monitoring ${ownerName}`
                  : isSender ? "Your Past Session" : `${ownerName}'s Session`}
              </h3>
              {!isSender && <p className="text-[10px] font-mono text-zinc-400 mt-0.5">{activeDetailSession.user_phone}</p>}
            </div>
          </div>
        </div>

        {/* Destination Info */}
        <div className="bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-3.5 space-y-2.5 shadow-xs">
          <div>
            <p className="text-[9px] font-bold uppercase text-zinc-400 tracking-wider">Destination</p>
            <h4 className="text-base font-bold text-black dark:text-white leading-tight mt-0.5">{activeDetailSession.destination}</h4>
          </div>

          <div className="bg-zinc-50 dark:bg-zinc-800/50 p-2.5 rounded-xl flex items-center justify-between border border-zinc-200/50 dark:border-zinc-800/50">
            <div>
              <p className="text-[9px] font-bold uppercase text-zinc-400">
                {isActive ? "Expected Arrival Time" : "Expected Arrival"}
              </p>
              <p className="text-xs font-bold font-mono text-black dark:text-white mt-0.5">
                {new Date(activeDetailSession.expected_arrival_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <Clock className="w-4 h-4 text-zinc-400" />
          </div>
        </div>

        {/* Active Session Sender Timer Controls */}
        {isActive && isSender && (
          <section className="space-y-3 rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-4">
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Time Until Expected Arrival</p>
              <p className="font-mono text-3xl font-bold text-yellow-500 mt-1" aria-live="polite">
                {countdownSeconds > 0 ? formatCountdown(countdownSeconds) : "OVERDUE"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void confirmSafe(activeDetailSession)}
              className="w-full rounded-xl bg-yellow-400 py-3 text-xs font-bold text-black active:scale-[0.98] transition-transform shadow-xs"
            >
              Confirm I’m Safe
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void extendSession(activeDetailSession)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 py-2.5 text-xs font-bold text-black dark:text-white bg-white dark:bg-zinc-800"
              >
                <Plus className="h-3.5 w-3.5" /> Extend 15m
              </button>
              <button
                type="button"
                onClick={() => void endSession(activeDetailSession)}
                className="rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white"
              >
                End Session
              </button>
            </div>
          </section>
        )}

        {/* Map View for Active vs Coordinates Display for Ended */}
        <div ref={mapSectionRef} className="space-y-2 scroll-mt-4">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center space-x-1">
              <MapPin className="w-3.5 h-3.5 text-yellow-500" />
              <span>{isActive ? "Live GPS Location" : "Last Reported Coordinates"}</span>
            </h4>
            {isActive && activeDetailCoordinates && (
              <span className="text-[9px] font-mono text-emerald-500 font-bold flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                <span>Connected</span>
              </span>
            )}
          </div>

          {isActive ? (
            activeDetailCoordinates ? (
              <div className="rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-xs">
                <SatelliteMap
                  latitude={activeDetailCoordinates.latitude}
                  longitude={activeDetailCoordinates.longitude}
                  className="h-48 w-full"
                />
              </div>
            ) : (
              <div className="h-32 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center p-3 text-center space-y-1.5">
                <Navigation className="w-5 h-5 text-zinc-400 animate-bounce" />
                <p className="text-xs font-medium text-zinc-500">Waiting for GPS updates...</p>
              </div>
            )
          ) : (
            <div className="bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-3.5 space-y-2.5">
              {activeDetailCoordinates ? (
                <>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-zinc-600 dark:text-zinc-400">
                      {activeDetailCoordinates.latitude.toFixed(5)}°, {activeDetailCoordinates.longitude.toFixed(5)}°
                    </span>
                    <span className="text-[10px] text-zinc-400 font-medium">GPS Fixed</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openInDeviceMaps(activeDetailCoordinates.latitude, activeDetailCoordinates.longitude)}
                    className="w-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-black dark:text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center space-x-2 transition-colors border border-zinc-200 dark:border-zinc-700"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-yellow-500" />
                    <span>Open in Maps App</span>
                  </button>
                </>
              ) : (
                <p className="text-xs text-zinc-500 text-center py-2">No GPS coordinates recorded for this session.</p>
              )}
            </div>
          )}
        </div>

        {/* Timestamps & Duration */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/50 dark:border-zinc-800/50 rounded-xl p-2.5 space-y-0.5">
            <p className="text-[9px] font-bold uppercase text-zinc-400">Started</p>
            <p className="font-bold text-[11px] text-black dark:text-white">
              {new Date(activeDetailSession.created_at).toLocaleString([], {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>

          <div className="bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/50 dark:border-zinc-800/50 rounded-xl p-2.5 space-y-0.5">
            <p className="text-[9px] font-bold uppercase text-zinc-400">Planned Duration</p>
            <p className="font-bold text-[11px] text-black dark:text-white">
              {formatSessionDuration(activeDetailSession.created_at, activeDetailSession.expected_arrival_at)}
            </p>
          </div>
        </div>

        {/* Participants / Guardians */}
        {isSender ? (
          <section className="space-y-2 rounded-xl border border-zinc-200/70 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 p-3">
            <h4 className="flex items-center gap-2 text-xs font-bold text-black dark:text-white">
              <Users className="h-3.5 w-3.5 text-yellow-500" /> Guardians Assigned
            </h4>
            {activeGuardians.length > 0 ? (
              <ul className="space-y-1.5">
                {activeGuardians.map((guardian) => (
                  <li key={guardian.id} className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-black dark:text-white">{guardian.name}</span>
                    <span className="font-mono text-zinc-500 text-[11px]">{guardian.phone}</span>
                  </li>
                ))}
              </ul>
            ) : guardianPhones.length > 0 ? (
              <ul className="space-y-1.5">
                {guardianPhones.map((phone) => <li key={phone} className="font-mono text-xs text-zinc-500">{phone}</li>)}
              </ul>
            ) : (
              <p className="text-[11px] text-zinc-500">No specific contacts assigned.</p>
            )}
          </section>
        ) : (
          <div className="bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/50 dark:border-zinc-800/50 p-2.5 rounded-xl text-xs space-y-1">
            <p className="text-[9px] font-bold uppercase text-zinc-400 flex items-center space-x-1">
              <Users className="w-3 h-3 text-yellow-500" />
              <span>Shared Participants</span>
            </p>
            <p className="font-semibold text-[11px] text-black dark:text-white">
              {getSessionParticipantNames(activeDetailSession, contacts, userPhone, ownerName).join(", ")}
            </p>
          </div>
        )}

        {/* Notes */}
        {activeDetailSession.notes && (
          <div className="bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/50 dark:border-zinc-800/50 p-2.5 rounded-xl text-xs space-y-1">
            <p className="text-[9px] font-bold uppercase text-zinc-400 flex items-center space-x-1">
              <MessageSquare className="w-3 h-3 text-yellow-500" />
              <span>Note</span>
            </p>
            <p className="text-zinc-700 dark:text-zinc-200 font-medium text-[11px]">{activeDetailSession.notes}</p>
          </div>
        )}

        {/* Receiver Actions */}
        {!isSender && (
          <section className="space-y-2 pt-1">
            <a
              href={`tel:${activeDetailSession.user_phone}`}
              className="w-full bg-black dark:bg-white text-white dark:text-black font-bold py-3 rounded-xl text-xs flex items-center justify-center space-x-2 active:scale-98 transition-transform shadow-xs"
            >
              <Phone className="w-3.5 h-3.5 fill-current" />
              <span>Call {ownerName}</span>
            </a>
            {isActive && (
              <button
                type="button"
                onClick={() => void shareEmergencyDetails(activeDetailSession, ownerName)}
                className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-3 text-xs font-bold text-black dark:text-white"
              >
                Share Emergency Details
              </button>
            )}
            {shareFeedback && <p role="status" className="text-center text-[11px] font-bold text-emerald-600">{shareFeedback}</p>}
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-bold text-black dark:text-white">Shared Feeds</h2>
        <p className="text-[10px] text-zinc-500">
          Live journey sessions shared within your circle.
        </p>
      </div>

      {/* Active Shared Feeds */}
      {sessionsLoading ? (
        <div className="py-8 flex justify-center items-center">
          <Loader2 className="w-5 h-5 animate-spin text-yellow-500" />
        </div>
      ) : sharedSessions.length === 0 ? (
        <div className="text-center py-7 px-4 bg-white/60 dark:bg-zinc-900/40 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl space-y-1">
          <Radio className="w-5 h-5 text-zinc-400 mx-auto" />
          <p className="text-xs font-bold text-black dark:text-white">No Active Sessions</p>
          <p className="text-[10px] text-zinc-400 max-w-xs mx-auto">
            Active journey check-ins will appear here in real-time.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sharedSessions.map((s) => {
            const displayName = getSenderDisplayName(s);
            const timestamp = new Date(s.created_at);

            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveDetailSession(s)}
                className="w-full bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/50 dark:border-zinc-800/50 p-3 rounded-xl shadow-xs flex items-center justify-between gap-2.5 text-left cursor-pointer hover:border-yellow-500/50 active:scale-[0.99] transition-all group"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="relative shrink-0">
                    <div className="w-9 h-9 rounded-xl overflow-hidden bg-zinc-900 text-yellow-400 font-bold text-xs flex items-center justify-center uppercase border border-zinc-800">
                      {s.user?.avatar_url ? (
                        <img src={s.user.avatar_url} alt={`${displayName}'s profile`} className="w-full h-full object-cover" />
                      ) : (
                        displayName.slice(0, 2)
                      )}
                    </div>
                    <span className="w-2 h-2 bg-emerald-500 border border-white dark:border-black rounded-full absolute -bottom-0.5 -right-0.5 animate-ping" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs font-bold text-black dark:text-white truncate">{displayName}</span>
                      <span className="text-[8px] font-bold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded-md shrink-0">LIVE</span>
                    </div>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-300 font-medium truncate mt-0.5">{s.destination}</p>
                    <p className="text-[9px] text-zinc-400 mt-0.5">
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

      {/* Recents & History Section with Sent / Received Tab Switchers */}
      <section className="space-y-2.5 pt-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-black dark:text-white">Recents &amp; History</h3>
          
          {/* Tab Switcher */}
          <div className="flex bg-zinc-100 dark:bg-zinc-800/80 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700/50">
            <button
              type="button"
              onClick={() => setHistoryTab("sent")}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                historyTab === "sent"
                  ? "bg-white dark:bg-zinc-900 text-black dark:text-white shadow-xs"
                  : "text-zinc-500 hover:text-black dark:hover:text-white"
              }`}
            >
              Sent ({sentHistory.length})
            </button>
            <button
              type="button"
              onClick={() => setHistoryTab("received")}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                historyTab === "received"
                  ? "bg-white dark:bg-zinc-900 text-black dark:text-white shadow-xs"
                  : "text-zinc-500 hover:text-black dark:hover:text-white"
              }`}
            >
              Received ({receivedHistory.length})
            </button>
          </div>
        </div>

        {/* History Session List */}
        {((historyTab === "sent" ? sentHistory : receivedHistory).length === 0) ? (
          <p className="text-[10px] text-zinc-400 px-1 py-4 text-center">
            {historyTab === "sent" ? "No sent session history." : "No received session history."}
          </p>
        ) : (
          <div className="space-y-1.5">
            {(historyTab === "sent" ? sentHistory : receivedHistory).map((session) => {
              const displayName = getSenderDisplayName(session);
              const isCompleted = session.status === "completed";

              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => setActiveDetailSession(session)}
                  className="w-full bg-white/80 dark:bg-zinc-900/70 border border-zinc-200/50 dark:border-zinc-800/50 p-2.5 px-3 rounded-xl flex items-center justify-between text-left hover:border-yellow-500/50 transition-colors"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-black dark:text-white truncate">{displayName}</span>
                      <span className={`text-[8px] font-bold uppercase px-1.5 py-0.2 rounded-md ${
                        isCompleted
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                      }`}>
                        {session.status}
                      </span>
                    </span>
                    <span className="block text-[10px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">{session.destination}</span>
                    <span className="block text-[9px] text-zinc-400 mt-0.5">
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