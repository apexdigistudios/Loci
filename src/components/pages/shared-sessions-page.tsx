"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Radio,
  Loader2,
  Clock,
  Phone,
  ChevronRight,
  ChevronLeft,
  MapPin,
  MessageSquare,
  Navigation,
  Maximize2,
  Minimize2,
  Lock,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { SatelliteMap } from "../ui/satellite-map";
import { cleanPhone } from "@/lib/utils";
import { useSubscription } from "@/hooks/use-subscription";

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
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata as Record<string, unknown> : {};
  
  const readCoordinate = (...values: unknown[]) => {
    const value = values.find((candidate) => candidate !== undefined && candidate !== null && candidate !== "");
    const coordinate = typeof value === "number" ? value : Number(value);
    return Number.isFinite(coordinate) ? coordinate : null;
  };
  const geoJsonCoordinates = Array.isArray(location.coordinates) ? location.coordinates : [];
  
  const latitude = readCoordinate(row.current_lat, metadata.latitude, row.latitude, row.lat, row.location_latitude, row.last_latitude, location.latitude, location.lat, geoJsonCoordinates[1]);
  const longitude = readCoordinate(row.current_lng, metadata.longitude, row.longitude, row.lng, row.location_longitude, row.last_longitude, location.longitude, location.lng, geoJsonCoordinates[0]);

  return latitude !== null && longitude !== null && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
    ? { latitude, longitude }
    : null;
}

function getSessionLocationAddress(session: SharedSession): string {
  const row = session as Record<string, unknown>;
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata as Record<string, unknown> : {};
  if (typeof metadata.address === "string" && metadata.address.trim()) {
    return metadata.address;
  }
  return "";
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
  onNavigate?: (tab: "home" | "session" | "contacts" | "share" | "profile") => void;
}

export function SharedSessionsPage({
  userPhone,
  currentUserId,
  contacts,
  openSessionId,
  onSessionOpened,
  onNavigate,
}: SharedSessionsPageProps) {
  const { tier } = useSubscription(currentUserId || undefined, userPhone);
  const [sharedSessions, setSharedSessions] = useState<SharedSession[]>([]);
  const [historySessions, setHistorySessions] = useState<SharedSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [activeDetailSessionId, setActiveDetailSessionId] = useState<string | null>(null);
  const [detailNow, setDetailNow] = useState(0);
  const [shareFeedback, setShareFeedback] = useState("");
  const [historyTab, setHistoryTab] = useState<"sent" | "received">("sent");
  
  const [isMapFullScreen, setIsMapFullScreen] = useState(false);
  const [receiverCoords, setReceiverCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showDirections, setShowDirections] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState<{ nickname?: string; avatar_url?: string } | null>(null);

  const activeDetailSession = useMemo(() => {
    if (!activeDetailSessionId) return null;
    return [...sharedSessions, ...historySessions].find((s) => s.id === activeDetailSessionId) || null;
  }, [activeDetailSessionId, sharedSessions, historySessions]);

  useEffect(() => {
    const timer = window.setInterval(() => setDetailNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!currentUserId && !userPhone) return;
    async function fetchMyProfile() {
      let query = supabase.from("users").select("nickname, full_name, avatar_url");
      if (currentUserId) {
        query = query.eq("id", currentUserId);
      } else {
        query = query.eq("phone", cleanPhone(userPhone));
      }
      const { data } = await query.maybeSingle();
      if (data) {
        setCurrentUserProfile({
          nickname: data.nickname || data.full_name || "You",
          avatar_url: data.avatar_url,
        });
      }
    }
    void fetchMyProfile();
  }, [currentUserId, userPhone]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        setReceiverCoords({ latitude: coords.latitude, longitude: coords.longitude });
      },
      (err) => console.warn("Receiver geolocation watch error:", err),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

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
      }
      if (currentUserPhone) {
        filters.push(`user_phone.eq.${userPhone}`);
      }
      if (matchedRecipientIds.length > 0) {
        filters.push(`id.in.(${matchedRecipientIds.join(",")})`);
      }
      filters.push(`status.eq.escalated`);

      const { data: sessionsData, error: sessionsErr } = await supabase
        .from("checkin_sessions")
        .select("*")
        .or(filters.join(","))
        .order("created_at", { ascending: false });

      if (sessionsErr) console.error("Error fetching sessions:", sessionsErr);

      const allSessions = sessionsData || [];

      const activeRows = allSessions.filter((s) => s.status === "active" || s.status === "escalated" || s.status === "missed");
      const historyRows = allSessions.filter((s) => s.status === "completed" || s.status === "expired");

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
    } catch (err) {
      console.error("Error fetching shared sessions:", err);
    } finally {
      setSessionsLoading(false);
    }
  }, [currentUserId, userPhone]);

  // Real-time Supabase subscription with safe deep-merging of coordinates & metadata
  useEffect(() => {
    const loadTimer = window.setTimeout(() => void fetchSharedSessions(), 0);

    const channel = supabase
      .channel("checkin_sessions_realtime_feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "checkin_sessions" },
        (payload) => {
          if (process.env.NODE_ENV === "development") {
            const newRow = payload.new as Record<string, unknown> | null;
            const oldRow = payload.old as Record<string, unknown> | null;
            console.log("[checkin_sessions realtime] event:", payload.eventType);
            console.log("[checkin_sessions realtime] new row:", payload.new);
            console.log("[checkin_sessions realtime] session id:", newRow?.id || oldRow?.id || null);
          }

          if (payload.eventType === "UPDATE" && payload.new) {
            const updated = payload.new as SharedSession;
            setSharedSessions((prev) =>
              prev.map((s) =>
                s.id === updated.id
                  ? {
                      ...s,
                      ...updated,
                      metadata: updated.metadata ? { ...(s.metadata || {}), ...(updated.metadata as Record<string, unknown>) } : s.metadata,
                      user: updated.user || s.user,
                    }
                  : s
              )
            );
            setHistorySessions((prev) =>
              prev.map((s) =>
                s.id === updated.id
                  ? {
                      ...s,
                      ...updated,
                      metadata: updated.metadata ? { ...(s.metadata || {}), ...(updated.metadata as Record<string, unknown>) } : s.metadata,
                      user: updated.user || s.user,
                    }
                  : s
              )
            );
          } else {
            void fetchSharedSessions();
          }
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
      setActiveDetailSessionId(targetSession.id);
      onSessionOpened?.();
    }, 0);
    return () => window.clearTimeout(openTimer);
  }, [openSessionId, onSessionOpened, sharedSessions]);

  const activeDetailCoordinates = activeDetailSession
    ? getSessionCoordinates(activeDetailSession)
    : null;

  const activeDetailAddress = activeDetailSession
    ? getSessionLocationAddress(activeDetailSession)
    : "";

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
    const isActive = activeDetailSession.status === "active" || activeDetailSession.status === "escalated" || activeDetailSession.status === "missed";
    
    const sessionMetadata = activeDetailSession.metadata && typeof activeDetailSession.metadata === "object" ? activeDetailSession.metadata as Record<string, unknown> : {};
    const isSosEmergency = 
      activeDetailSession.status === "escalated" ||
      activeDetailSession.notes?.toLowerCase().includes("sos") || 
      activeDetailSession.destination?.toLowerCase().includes("sos") ||
      activeDetailSession.notes?.toLowerCase().includes("emergency") ||
      sessionMetadata.type === "emergency" ||
      sessionMetadata.is_sos === true;

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
      if (isSosEmergency) return "🚨 SOS EMERGENCY";
      if (isActive) return isOverdue ? "OVERDUE" : "ACTIVE";
      if (activeDetailSession.status === "completed") return "COMPLETED";
      return activeDetailSession.status.toUpperCase();
    };

    const statusLabel = getStatusLabel();

    return (
      <div className="space-y-3.5 animate-in fade-in slide-in-from-right-4 min-h-[80vh] pb-8 max-w-md mx-auto px-2 sm:px-0">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setActiveDetailSessionId(null)}
            className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white active:scale-95 transition-all flex items-center space-x-1 pr-3 border border-zinc-200 dark:border-zinc-700 shrink-0"
          >
            <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
            <span className="text-xs font-bold">Back to Feeds</span>
          </button>

          <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
            isSosEmergency
              ? "bg-red-600 text-white font-black animate-pulse shadow-md"
              : statusLabel === "ACTIVE"
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
          }`}>
            {isActive && <Radio className="w-3 h-3 animate-pulse text-emerald-500 shrink-0" />}
            <span className="truncate">{statusLabel}</span>
          </span>
        </div>

        <div className="bg-zinc-900 text-white p-3.5 rounded-2xl border border-zinc-800 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-11 h-11 rounded-xl overflow-hidden bg-zinc-800 text-yellow-400 font-bold text-sm flex items-center justify-center uppercase border border-zinc-700 shrink-0">
              {activeDetailSession.user?.avatar_url ? (
                <img src={activeDetailSession.user.avatar_url} alt={`${ownerName}'s profile`} className="w-full h-full object-cover" />
              ) : (
                ownerName.slice(0, 2)
              )}
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider block">
                {isSender ? "Sent Session" : "Received Session"}
              </span>
              <h3 className="text-sm font-bold text-white truncate leading-tight">
                {isActive
                  ? isSender ? "Your Active Safety Watch" : `Monitoring ${ownerName}`
                  : isSender ? "Your Past Session" : `${ownerName}'s Session`}
              </h3>
              {!isSender && <p className="text-[10px] font-mono text-zinc-400 truncate mt-0.5">{activeDetailSession.user_phone}</p>}
            </div>
          </div>
        </div>

        <div className="bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-3.5 space-y-2.5 shadow-xs">
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase text-zinc-400 tracking-wider">Destination / Alert</p>
            <h4 className="text-sm sm:text-base font-bold text-black dark:text-white truncate leading-tight mt-0.5">{activeDetailSession.destination}</h4>
          </div>

          <div className="bg-zinc-50 dark:bg-zinc-800/50 p-2.5 rounded-xl flex items-center justify-between gap-2 border border-zinc-200/50 dark:border-zinc-800/50">
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase text-zinc-400">
                {isActive ? "Expected Arrival Time" : "Expected Arrival"}
              </p>
              <p className="text-xs font-bold font-mono text-black dark:text-white truncate mt-0.5">
                {new Date(activeDetailSession.expected_arrival_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <Clock className="w-4 h-4 text-zinc-400 shrink-0" />
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-zinc-200/70 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/70 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <MapPin className="w-4 h-4 shrink-0 text-emerald-500" />
                <div className="min-w-0">
                  <p className="text-[11px] font-extrabold text-black dark:text-white truncate">Live Location / Pinned Address</p>
                  <p className="text-[10px] text-zinc-600 dark:text-zinc-300 font-semibold truncate">
                    {activeDetailAddress
                      ? activeDetailAddress
                      : activeDetailCoordinates
                        ? `${activeDetailCoordinates.latitude.toFixed(5)}, ${activeDetailCoordinates.longitude.toFixed(5)}`
                        : "No GPS coordinates recorded"}
                  </p>
                </div>
              </div>
              {activeDetailCoordinates && (
                <button
                  type="button"
                  onClick={() => openInDeviceMaps(activeDetailCoordinates.latitude, activeDetailCoordinates.longitude)}
                  className="shrink-0 text-[10px] font-extrabold text-black dark:text-white px-3 py-2 rounded-full bg-yellow-400 hover:bg-yellow-300 transition-colors"
                >
                  Open Maps
                </button>
              )}
            </div>
          </div>

          {activeDetailCoordinates && (
            <div className="space-y-2">
              <div className="relative group">
                <div onClick={() => setIsMapFullScreen(true)} className="cursor-pointer">
                  <SatelliteMap
                    key={`map-${activeDetailCoordinates.latitude}-${activeDetailCoordinates.longitude}`}
                    latitude={activeDetailCoordinates.latitude}
                    longitude={activeDetailCoordinates.longitude}
                    nickname={ownerName}
                    avatarUrl={activeDetailSession.user?.avatar_url}
                    receiverNickname={currentUserProfile?.nickname || "You"}
                    receiverAvatarUrl={currentUserProfile?.avatar_url}
                    interactive={false}
                    showDirections={showDirections}
                    receiverLocation={receiverCoords || undefined}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setIsMapFullScreen(true)}
                  className="absolute top-2 right-2 p-2 rounded-xl bg-black/70 backdrop-blur-md text-white border border-zinc-700 active:scale-90 transition-all flex items-center space-x-1 text-[10px] font-bold shadow-lg shrink-0"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Expand Map</span>
                </button>
              </div>

              {isSosEmergency && !isSender && (
                <div className="rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2 min-w-0">
                      <Navigation className="w-4 h-4 text-yellow-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-black text-black dark:text-white truncate">Sender Navigation &amp; Route</p>
                        <p className="text-[10px] text-zinc-500 truncate">Draw directions from your location</p>
                      </div>
                    </div>
                    {tier === "plus" ? (
                      <button
                        type="button"
                        onClick={() => setShowDirections(!showDirections)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                          showDirections
                            ? "bg-yellow-400 text-black font-black"
                            : "bg-zinc-200 dark:bg-zinc-800 text-black dark:text-white"
                        }`}
                      >
                        {showDirections ? "Hide Route" : "Show Route"}
                      </button>
                    ) : (
                      <div className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-yellow-400/20 text-yellow-600 dark:text-yellow-400 text-xs font-bold border border-yellow-400/30 shrink-0">
                        <Lock className="w-3 h-3" />
                        <span onClick={() => onNavigate?.("profile")} className="cursor-pointer underline">Plus Feature</span>
                      </div>
                    )}
                  </div>
                  {tier !== "plus" && (
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-tight">
                      Upgrade to Déloci Plus to unlock real-time turn-by-turn routing to the sender!
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {isMapFullScreen && activeDetailCoordinates && (
          <div className="fixed inset-0 z-99999 bg-white/95 dark:bg-black/90 backdrop-blur-md flex items-center justify-center p-3 transition-colors">
            <div className="w-full max-w-md h-[90vh] bg-zinc-100 dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between overflow-hidden p-3 shadow-2xl">
              <div className="flex items-center justify-between pb-2">
                <div className="flex items-center space-x-2 min-w-0">
                  <span className="text-xs font-black text-black dark:text-white truncate">Expanded Emergency Map</span>
                  {showDirections && <span className="text-[9px] font-bold bg-yellow-400 text-black px-2 py-0.5 rounded-full shrink-0">Route Active</span>}
                </div>
                <button
                  type="button"
                  onClick={() => setIsMapFullScreen(false)}
                  className="p-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-black dark:text-white text-xs font-bold flex items-center space-x-1 px-3 active:scale-95 transition-all shrink-0"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>Close</span>
                </button>
              </div>
              <div className="flex-1 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 relative">
                <SatelliteMap
                  key={`modal-map-${activeDetailCoordinates.latitude}-${activeDetailCoordinates.longitude}`}
                  latitude={activeDetailCoordinates.latitude}
                  longitude={activeDetailCoordinates.longitude}
                  nickname={ownerName}
                  avatarUrl={activeDetailSession.user?.avatar_url}
                  receiverNickname={currentUserProfile?.nickname || "You"}
                  receiverAvatarUrl={currentUserProfile?.avatar_url}
                  interactive
                  showDirections={showDirections}
                  receiverLocation={receiverCoords || undefined}
                  className="h-full w-full"
                />
              </div>
            </div>
          </div>
        )}

        {activeDetailSession.notes && (
          <div className="bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/50 dark:border-zinc-800/50 p-3 rounded-xl text-xs space-y-1">
            <p className="text-[9px] font-bold uppercase text-zinc-400 flex items-center space-x-1">
              <MessageSquare className="w-3 h-3 text-yellow-500 shrink-0" />
              <span>SOS Emergency Note</span>
            </p>
            <p className="text-zinc-700 dark:text-zinc-200 font-medium text-[11px] wrap-break-words">{activeDetailSession.notes}</p>
          </div>
        )}

        {!isSender && (
          <section className="space-y-2 pt-1">
            <a
              href={`tel:${activeDetailSession.user_phone}`}
              className="w-full bg-black dark:bg-white text-white dark:text-black font-bold py-3.5 rounded-xl text-xs flex items-center justify-center space-x-2 active:scale-98 transition-transform shadow-xs"
            >
              <Phone className="w-3.5 h-3.5 fill-current shrink-0" />
              <span className="truncate">Call {ownerName}</span>
            </a>
            {isActive && (
              <button
                type="button"
                onClick={() => void shareEmergencyDetails(activeDetailSession, ownerName)}
                className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-3.5 text-xs font-bold text-black dark:text-white"
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
    <div className="space-y-5 max-w-md mx-auto px-2 sm:px-0 pb-10">
      <div>
        <h2 className="text-sm font-bold text-black dark:text-white">Shared Feeds</h2>
        <p className="text-[10px] text-zinc-500">
          Live journey sessions shared within your circle.
        </p>
      </div>

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
            const isSosItem = s.status === "escalated" || s.destination?.includes("SOS");

            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveDetailSessionId(s.id)}
                className={`w-full border p-3 rounded-xl shadow-xs flex items-center justify-between gap-3 text-left cursor-pointer transition-all group ${
                  isSosItem
                    ? "bg-red-500/10 dark:bg-red-950/30 border-red-500/40 hover:border-red-500"
                    : "bg-white/80 dark:bg-zinc-900/80 border-zinc-200/50 dark:border-zinc-800/50 hover:border-yellow-500/50"
                }`}
              >
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div className="relative shrink-0">
                    <div className="w-9 h-9 rounded-xl overflow-hidden bg-zinc-900 text-yellow-400 font-bold text-xs flex items-center justify-center uppercase border border-zinc-800">
                      {s.user?.avatar_url ? (
                        <img src={s.user.avatar_url} alt={`${displayName}'s profile`} className="w-full h-full object-cover" />
                      ) : (
                        displayName.slice(0, 2)
                      )}
                    </div>
                    <span className={`w-2 h-2 rounded-full absolute -bottom-0.5 -right-0.5 animate-ping ${isSosItem ? "bg-red-500" : "bg-emerald-500"}`} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-1.5 flex-wrap">
                      <span className="text-xs font-bold text-black dark:text-white truncate">{displayName}</span>
                      <span className={`text-[8px] font-bold uppercase px-1.5 py-0.2 rounded-md shrink-0 ${
                        isSosItem
                          ? "bg-red-600 text-white font-black animate-pulse"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      }`}>
                        {isSosItem ? "🚨 SOS" : "LIVE"}
                      </span>
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

      {/* RECENTS & HISTORY SECTION (Sent / Received Tabs) */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center justify-between px-0.5 gap-2 flex-wrap">
          <h3 className="text-xs font-bold text-black dark:text-white truncate">Recents &amp; History</h3>
          
          <div className="flex bg-zinc-100 dark:bg-zinc-800/80 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700/50 shrink-0">
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

        {((historyTab === "sent" ? sentHistory : receivedHistory).length === 0) ? (
          <p className="text-[10px] text-zinc-400 px-1 py-4 text-center bg-zinc-50 dark:bg-zinc-900/30 rounded-2xl border border-zinc-200/40 dark:border-zinc-800/40">
            {historyTab === "sent" ? "No sent session history." : "No received session history."}
          </p>
        ) : (
          <div className="space-y-2">
            {(historyTab === "sent" ? sentHistory : receivedHistory).map((session) => {
              const displayName = getSenderDisplayName(session);
              const isCompleted = session.status === "completed";

              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => setActiveDetailSessionId(session.id)}
                  className="w-full bg-white/80 dark:bg-zinc-900/70 border border-zinc-200/50 dark:border-zinc-800/50 p-3 rounded-xl flex items-center justify-between text-left hover:border-yellow-500/50 transition-colors gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-black dark:text-white truncate">{displayName}</span>
                      <span className={`text-[8px] font-bold uppercase px-1.5 py-0.2 rounded-md shrink-0 ${
                        isCompleted
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                      }`}>
                        {session.status}
                      </span>
                    </div>
                    <span className="block text-[11px] text-zinc-600 dark:text-zinc-300 truncate mt-0.5">{session.destination}</span>
                    <span className="block text-[9px] text-zinc-400 mt-0.5">
                      {new Date(session.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0 ml-1" />
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}