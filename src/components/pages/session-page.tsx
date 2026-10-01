"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  ChevronLeft,
  Clock,
  Loader2,
  MapPin,
  Check,
  Camera,
  Paperclip,
  X,
  Play,
  Plus,
  Bell,
  User,
  Calendar as CalendarIcon,
  Zap,
  MessageSquare,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { SatelliteMap } from "@/components/ui/satellite-map";

interface Contact {
  id: string;
  name: string;
  phone: string;
  isLociUser?: boolean;
  avatar_url?: string;
  group_category?: string;
}

interface ActiveSession {
  id: string;
  destination: string;
  expected_arrival_at: string;
  status: "active" | "completed" | "missed" | "escalated";
}

interface SessionPageProps {
  sessionHeadingSrc: string;
  activeSession: ActiveSession | null;
  destination: string;
  setDestination: (v: string) => void;
  durationMinutes: number | "";
  setDurationMinutes: (v: number | "") => void;
  notes: string;
  setNotes: (v: string) => void;
  contacts: Contact[];
  selectedContactIds: string[];
  toggleContactSelection: (id: string) => void;
  sessionLoading: boolean;
  handleStartSession: (e: React.FormEvent) => void;
  handleCompleteSession: () => void;
  onNavigate: (tab: "home" | "session" | "contacts" | "share" | "profile") => void;
}

export function SessionPage({
  sessionHeadingSrc,
  activeSession,
  destination,
  setDestination,
  durationMinutes,
  setDurationMinutes,
  notes,
  setNotes,
  contacts,
  selectedContactIds,
  toggleContactSelection,
  sessionLoading,
  handleStartSession,
  handleCompleteSession,
  onNavigate,
}: SessionPageProps) {
  const [attachedMedia, setAttachedMedia] = useState<{
    file: File;
    previewUrl: string;
    type: "image" | "video";
  } | null>(null);

  const [isCameraActive, setIsCameraActive] = useState(false);

  const [selectedDayOffset, setSelectedDayOffset] = useState<number>(0);
  const [returnTimeStr, setReturnTimeStr] = useState<string>(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30);
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  });

  const [targetEndTime, setTargetEndTime] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  const [showAlertModal, setShowAlertModal] = useState(false);
  const [guardianAlertMins, setGuardianAlertMins] = useState<number | "">(5);
  const [selfReminderMins, setSelfReminderMins] = useState<number | "">(5);
  const [activeAlertConfig, setActiveAlertConfig] = useState<{
    guardianMins: number;
    selfMins: number;
  } | null>(null);

  const [guardianNotificationFired, setGuardianNotificationFired] = useState(false);
  const [reminderNotificationFired, setReminderNotificationFired] = useState(false);
  const guardianNotificationFiredRef = useRef(false);
  const [contactSelectionMode, setContactSelectionMode] = useState<"individual" | "groups">("individual");

  const [locationCoords, setLocationCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "requesting" | "granted" | "denied">("idle");
  const [locationUpdatedAt, setLocationUpdatedAt] = useState<Date | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const locationWatchIdRef = useRef<number | null>(null);

  const sharedContacts = useMemo(
    () => contacts.filter((c) => selectedContactIds.includes(c.id)),
    [contacts, selectedContactIds]
  );
  const contactGroups = useMemo(
    () => Array.from(new Set(contacts.map((contact) => contact.group_category).filter((group): group is string => !!group))),
    [contacts]
  );

  const dispatchGuardianBroadcast = useCallback(async (event: string, details: Record<string, unknown>) => {
    if (!activeSession || activeSession.id.startsWith("local-")) return;

    await Promise.all(sharedContacts.map((contact) => new Promise<void>((resolve) => {
      const channel = supabase.channel(`guardian-alert-${encodeURIComponent(contact.phone)}`);
      let sent = false;
      let finished = false;
      const timeout = setTimeout(finish, 5000);

      function finish() {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        void supabase.removeChannel(channel);
        resolve();
      }

      channel.subscribe((status) => {
        if (status === "SUBSCRIBED" && !sent) {
          sent = true;
          void channel.send({
            type: "broadcast",
            event,
            payload: {
              ...details,
              sessionId: activeSession.id,
              recipientPhone: contact.phone,
            },
          }).then(finish, finish);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          finish();
        }
      });
    })));
  }, [activeSession, sharedContacts]);

  const requestCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus("denied");
      return;
    }

    setLocationStatus("requesting");
    if (locationWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(locationWatchIdRef.current);
    }
    locationWatchIdRef.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const latitude = coords.latitude;
        const longitude = coords.longitude;
        setLocationCoords({ latitude, longitude });
        setLocationUpdatedAt(new Date());
        setLocationStatus("granted");

        if (activeSession && !activeSession.id.startsWith("local-")) {
          void supabase
            .from("checkin_sessions")
            .update({ current_lat: latitude, current_lng: longitude })
            .eq("id", activeSession.id)
            .eq("status", "active")
            .then(({ error }) => {
              if (error) console.error("Failed to update live session location:", error);
            });
        }
      },
      () => setLocationStatus("denied"),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    );
  };

  useEffect(() => {
    if (!activeSession) return;

    requestCurrentLocation();
    return () => {
      if (locationWatchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(locationWatchIdRef.current);
        locationWatchIdRef.current = null;
      }
    };
  }, [activeSession]);

  // Dynamic Day Options for Return Picker
  const dayOptions = useMemo(() => {
    const options = [];
    const today = new Date();
    for (let i = 0; i < 5; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      let label = "";
      if (i === 0) label = "Today";
      else if (i === 1) label = "Tomorrow";
      else {
        label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      }
      options.push({ offset: i, label, dateStr: d.toDateString() });
    }
    return options;
  }, []);

  // Update target arrival time whenever user adjusts date/time inputs
  useEffect(() => {
    if (activeSession?.expected_arrival_at) {
      setTargetEndTime(new Date(activeSession.expected_arrival_at).getTime());
    } else {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + selectedDayOffset);
      const [hrs, mins] = returnTimeStr.split(":").map(Number);
      if (!isNaN(hrs) && !isNaN(mins)) {
        targetDate.setHours(hrs, mins, 0, 0);
      }
      const calculatedMins = Math.max(1, Math.round((targetDate.getTime() - Date.now()) / 60000));
      setDurationMinutes(calculatedMins);
      setTargetEndTime(targetDate.getTime());
    }
  }, [selectedDayOffset, returnTimeStr, activeSession, setDurationMinutes]);

  // Main Countdown Loop + Active Alert Timer Countdown & Notifications
  useEffect(() => {
    if (!targetEndTime) return;

    const updateTimer = () => {
      const diffSecs = Math.floor((targetEndTime - Date.now()) / 1000);
      setRemainingSeconds(Math.max(0, diffSecs));

      if (activeAlertConfig) {
        // Self Reminder Notification Trigger
        const selfReminderSecs = activeAlertConfig.selfMins * 60;
        if (diffSecs <= selfReminderSecs && diffSecs > 0 && !reminderNotificationFired) {
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            new Notification("⏰ Loci Check-In Reminder", {
              body: `Are you back safely? You have ${Math.ceil(diffSecs / 60)} minutes remaining to complete your session.`,
              icon: "/loci-dark.png",
            });
          }
          setReminderNotificationFired(true);
        }

        // Guardian Overdue Alert Notification Trigger
        const guardianDueAt = targetEndTime + activeAlertConfig.guardianMins * 60 * 1000;
        if (Date.now() >= guardianDueAt && !guardianNotificationFiredRef.current) {
          guardianNotificationFiredRef.current = true;
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            new Notification("🚨 SAFETY ALERT", {
              body: "🚨 SAFETY ALERT: Your session is overdue!",
              icon: "/loci-dark.png",
              tag: `overdue-session-${activeSession?.id || "active"}`,
            });
          }
          void dispatchGuardianBroadcast("guardian_alert_due", {
            destination: activeSession?.destination,
            expectedArrivalAt: new Date(targetEndTime).toISOString(),
            message: "This session is overdue. Please check in with your guardian.",
          });
          setGuardianNotificationFired(true);
        }
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [targetEndTime, activeAlertConfig, reminderNotificationFired, guardianNotificationFired, dispatchGuardianBroadcast, activeSession?.destination]);

  const formatTime = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    if (hrs > 0) {
      return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Compact Alert Timers Active Countdown Formatter
  const getGuardianAlertCountdown = () => {
    if (!activeAlertConfig || !targetEndTime) return "";
    const gTarget = targetEndTime + activeAlertConfig.guardianMins * 60 * 1000;
    const diff = Math.floor((gTarget - Date.now()) / 1000);
    if (diff <= 0) return "Alert Sent 🚨";
    return formatTime(diff);
  };

  const getSelfReminderCountdown = () => {
    if (!activeAlertConfig || !targetEndTime) return "";
    const rTarget = targetEndTime - activeAlertConfig.selfMins * 60 * 1000;
    const diff = Math.floor((rTarget - Date.now()) / 1000);
    if (diff <= 0) return "Triggered ⏰";
    return formatTime(diff);
  };

  const addTimeMinutes = (minsToAdd: number) => {
    const current = new Date();
    current.setMinutes(current.getMinutes() + minsToAdd);
    setReturnTimeStr(`${String(current.getHours()).padStart(2, "0")}:${String(current.getMinutes()).padStart(2, "0")}`);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      setIsCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      console.error("Camera access error:", err);
      const fallbackInput = document.createElement("input");
      fallbackInput.type = "file";
      fallbackInput.accept = "image/*";
      fallbackInput.setAttribute("capture", "user");
      fallbackInput.onchange = (e: Event) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          setAttachedMedia({
            file,
            previewUrl: URL.createObjectURL(file),
            type: "image",
          });
        }
      };
      fallbackInput.click();
    }
  };

  const captureSelfie = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `selfie-${Date.now()}.jpg`, {
            type: "image/jpeg",
          });
          setAttachedMedia({
            file,
            previewUrl: URL.createObjectURL(file),
            type: "image",
          });
        }
      }, "image/jpeg");
    }
    stopCamera();
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const handleGallerySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith("video/");
    setAttachedMedia({
      file,
      previewUrl: URL.createObjectURL(file),
      type: isVideo ? "video" : "image",
    });
  };

  const removeMedia = () => {
    if (attachedMedia?.previewUrl) {
      URL.revokeObjectURL(attachedMedia.previewUrl);
    }
    setAttachedMedia(null);
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  };

  const handleSaveAlertTimer = () => {
    const gMins = Number(guardianAlertMins) || 5;
    const sMins = Number(selfReminderMins) || 5;
    setActiveAlertConfig({ guardianMins: gMins, selfMins: sMins });
    guardianNotificationFiredRef.current = false;
    setGuardianNotificationFired(false);
    setReminderNotificationFired(false);
    setShowAlertModal(false);
  };

  const handleEndSession = () => {
    if (activeSession) {
      void dispatchGuardianBroadcast("session_completed", {
        destination: activeSession.destination,
        completedAt: new Date().toISOString(),
        message: "This session has ended safely.",
      });
    }
    handleCompleteSession();
  };

  return (
    <>
      {/* CAMERA OVERLAY */}
      {isCameraActive && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between p-4 max-w-md mx-auto">
          <div className="flex items-center justify-between pt-[max(0.75rem,env(safe-area-inset-top))] z-10 px-2">
            <button
              type="button"
              onClick={stopCamera}
              className="p-3 rounded-full bg-zinc-900/80 text-white backdrop-blur-xl active:scale-90 transition-all border border-zinc-800"
              title="Close Camera"
            >
              <X className="w-5 h-5" />
            </button>
            <span className="text-xs font-mono font-bold uppercase text-zinc-300 tracking-widest bg-zinc-900/80 px-4 py-1.5 rounded-full border border-zinc-800">
              Camera Viewfinder
            </span>
            <div className="w-11" />
          </div>

          <div className="absolute inset-0 overflow-hidden flex items-center justify-center bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover -scale-x-100"
            />
          </div>

          <div className="relative z-10 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex items-center justify-center">
            <button
              type="button"
              onClick={captureSelfie}
              className="w-20 h-20 rounded-full border-4 border-yellow-400 bg-yellow-400/20 backdrop-blur-md flex items-center justify-center p-1 active:scale-90 transition-all shadow-2xl"
            >
              <div className="w-full h-full bg-yellow-400 rounded-full flex items-center justify-center">
                <Camera className="w-8 h-8 text-black" />
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ACTIVE WATCH PAGEVIEW */}
      {activeSession ? (
        <div className="pt-2 space-y-6 min-h-[82vh] flex flex-col justify-between max-w-md mx-auto">
          <div className="space-y-6">
            {/* Top Back Control */}
            <div className="flex items-center justify-start">
              <button
                onClick={() => onNavigate("home")}
                className="p-2.5 rounded-full bg-zinc-200/60 dark:bg-zinc-900/60 backdrop-blur-xl text-black dark:text-white active:scale-90 transition-all shadow-sm flex items-center space-x-1.5 pr-4 border border-zinc-300/40 dark:border-zinc-800/50"
              >
                <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                <span className="text-xs font-bold">Home</span>
              </button>
            </div>

            {/* Location Icon & Shared Guardian Avatars with Loci Status Badges */}
            <div className="flex flex-col items-center justify-center space-y-3 pt-1">
              <div className="p-3 bg-zinc-200/50 dark:bg-zinc-900/60 border border-zinc-300/40 dark:border-zinc-800/60 rounded-2xl shadow-sm">
                <MapPin className="w-6 h-6 text-yellow-400" />
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 px-2">
                {sharedContacts.length === 0 ? (
                  <div className="w-9 h-9 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center border-2 border-black">
                    <User className="w-4 h-4" />
                  </div>
                ) : (
                  sharedContacts.map((c) => (
                    <div
                      key={c.id}
                      className="flex flex-col items-center gap-1.5"
                      title={`${c.name} (${c.isLociUser ? "Loci Guardian Active" : "SMS Alert Ready"})`}
                    >
                      <div className="relative w-10 h-10 rounded-full overflow-hidden bg-zinc-900 text-yellow-400 border-2 border-black font-black text-[11px] flex items-center justify-center uppercase shadow-md">
                        {c.avatar_url ? (
                          <img src={c.avatar_url} alt={`${c.name}'s profile`} className="w-full h-full object-cover" />
                        ) : (
                          c.name.slice(0, 2)
                        )}
                        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-black border border-zinc-800 flex items-center justify-center">
                          {c.isLociUser ? (
                            <Zap className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400" />
                          ) : (
                            <MessageSquare className="w-2 h-2 text-zinc-400" />
                          )}
                        </div>
                      </div>
                      <span className="max-w-20 truncate text-[10px] font-bold text-zinc-600 dark:text-zinc-300">{c.name}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* App Yellow Tall Extended Timer Digits */}
            <div className="flex items-center justify-center py-4">
              <span className="font-mono font-black text-6xl sm:text-7xl tracking-tighter scale-y-[1.3] text-yellow-400 select-none drop-shadow-[0_4px_16px_rgba(250,204,21,0.25)]">
                {formatTime(remainingSeconds)}
              </span>
            </div>

            {/* Requirement 2: Active Alert Countdown Display (Compact Badge) */}
            <div className="flex flex-col items-center text-center space-y-2.5 px-4">
              <button
                onClick={() => setShowAlertModal(true)}
                className="inline-flex items-center space-x-1.5 bg-yellow-400 hover:bg-yellow-500 text-black px-4 py-2 rounded-full font-extrabold text-xs active:scale-95 transition-all shadow-md shadow-yellow-400/20"
              >
                <Plus className="w-3.5 h-3.5 stroke-3" />
                <span>Add alert timer</span>
              </button>

              {activeAlertConfig && (
                <div className="flex flex-col items-center space-y-1.5">
                  <div className="bg-zinc-100 dark:bg-zinc-900 border border-yellow-400/50 px-3.5 py-1.5 rounded-full flex items-center space-x-3 text-[10px] font-bold text-black dark:text-white shadow-sm">
                    <div className="flex items-center space-x-1 text-yellow-400">
                      <Bell className="w-3 h-3" />
                      <span>Contact alert in:</span>
                      <span className="font-mono text-white bg-black/60 px-1.5 py-0.5 rounded border border-zinc-800">
                        {getGuardianAlertCountdown()}
                      </span>
                    </div>

                    <span className="text-zinc-600 dark:text-zinc-500">•</span>

                    <div className="flex items-center space-x-1 text-zinc-400">
                      <span>Reminder:</span>
                      <span className="font-mono text-zinc-300 bg-black/60 px-1.5 py-0.5 rounded border border-zinc-800">
                        {getSelfReminderCountdown()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 max-w-xs leading-relaxed">
                {activeAlertConfig
                  ? "Your alert timers are active and will notify your selected guardians if needed."
                  : "Configure and activate alert timers to notify your selected guardians if you are overdue."}
              </p>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-zinc-200/70 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/70 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin className={`w-4 h-4 shrink-0 ${locationStatus === "granted" ? "text-emerald-500" : "text-yellow-400"}`} />
                    <div className="min-w-0">
                      <p className="text-[11px] font-extrabold text-black dark:text-white">Live location</p>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                        {locationCoords
                          ? `${locationCoords.latitude.toFixed(5)}, ${locationCoords.longitude.toFixed(5)}`
                          : locationStatus === "denied"
                            ? "Location permission unavailable"
                            : locationStatus === "requesting" || locationStatus === "idle"
                              ? "Acquiring GPS Signal..."
                              : "Waiting for GPS permission"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={requestCurrentLocation}
                    className="shrink-0 text-[10px] font-extrabold text-black dark:text-white px-3 py-2 rounded-full bg-yellow-400 hover:bg-yellow-300 transition-colors"
                  >
                    {locationStatus === "requesting" ? "Acquiring..." : locationStatus === "granted" ? "Refresh" : "Enable location"}
                  </button>
                </div>
                {locationUpdatedAt && (
                  <p className="text-[9px] text-zinc-400">
                    Updated {locationUpdatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · refreshes every 5 minutes
                  </p>
                )}
              </div>

              {locationCoords && (
                <SatelliteMap latitude={locationCoords.latitude} longitude={locationCoords.longitude} />
              )}
            </div>
          </div>

          {/* End Session Button */}
          <div className="pb-6">
            <button
              onClick={handleEndSession}
              disabled={sessionLoading}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-extrabold py-4 rounded-full text-xs transition-all flex items-center justify-center space-x-2 active:scale-95 shadow-lg shadow-red-600/20"
            >
              {sessionLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-white" />
              ) : (
                <span>End Session</span>
              )}
            </button>
          </div>

          {/* Alert Configuration Modal */}
          {showAlertModal && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md p-4 flex items-center justify-center animate-in fade-in">
              <div className="bg-zinc-900 text-white border border-zinc-800 rounded-4xl p-6 w-full max-w-sm space-y-5 relative shadow-2xl">
                <button
                  onClick={() => setShowAlertModal(false)}
                  className="absolute top-4 right-4 p-2 rounded-full bg-zinc-800 text-zinc-400 hover:text-white active:scale-90 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="space-y-1">
                  <h3 className="text-sm font-extrabold flex items-center space-x-1.5 text-white">
                    <Bell className="w-4 h-4 text-yellow-400" />
                    <span>Configure Alert Timers</span>
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Set alert delays for your circle and automated check-in reminders.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-300">
                      Alert Contacts After Overdue (Minutes)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={guardianAlertMins}
                      onChange={(e) => setGuardianAlertMins(e.target.value ? Number(e.target.value) : "")}
                      className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-yellow-400"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-300">
                      Self Reminder Before Arrival (Minutes)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={selfReminderMins}
                      onChange={(e) => setSelfReminderMins(e.target.value ? Number(e.target.value) : "")}
                      className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-yellow-400"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSaveAlertTimer}
                  className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-extrabold py-3.5 rounded-full text-xs transition-all active:scale-95 shadow-md shadow-yellow-400/20"
                >
                  Activate Alert Timers
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* STANDARD TRIP CONFIGURATION FORM */
        <div className="pt-[max(0.5rem,env(safe-area-inset-top))] space-y-6">
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleGallerySelect}
            className="hidden"
          />

          <div className="relative flex items-center justify-center pt-2 pb-4">
            <button
              onClick={() => onNavigate("home")}
              className="absolute left-0 p-2.5 rounded-full bg-zinc-200/70 dark:bg-zinc-800/80 backdrop-blur-xl text-black dark:text-white active:scale-90 transition-all shadow-sm border border-zinc-300/40 dark:border-zinc-800/50"
              title="Back to Home"
            >
              <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
            </button>

            <img
              src={sessionHeadingSrc}
              alt="Session Heading"
              className="h-14 w-auto object-contain"
            />
          </div>

          <form onSubmit={handleStartSession} className="space-y-6">
            {/* Question 1: Destination */}
            <div className="space-y-2">
              <label className="block text-sm font-extrabold text-black dark:text-white px-1">
                Where are you heading? 📍
              </label>
              <div className="relative flex items-center">
                <MapPin className="w-4 h-4 absolute left-4 text-zinc-400" />
                <input
                  type="text"
                  required
                  placeholder="Enter destination or route"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-full bg-zinc-200/60 dark:bg-zinc-900/80 border border-zinc-300/50 dark:border-zinc-800 rounded-full pl-11 pr-5 py-3.5 text-xs font-semibold text-black dark:text-white focus:outline-none focus:border-yellow-400 transition-all shadow-inner"
                />
              </div>
            </div>

            {/* Requirement 1: Updated Question Label & Return Day/Time Picker Format */}
            <div className="space-y-3">
              <label className="block text-sm font-extrabold text-black dark:text-white px-1">
                When are you expecting to return? ⏱
              </label>

              {/* Day Chips Selector */}
              <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
                {dayOptions.map((opt) => (
                  <button
                    key={opt.offset}
                    type="button"
                    onClick={() => setSelectedDayOffset(opt.offset)}
                    className={`px-3.5 py-2.5 rounded-full text-xs font-extrabold shrink-0 transition-all border ${
                      selectedDayOffset === opt.offset
                        ? "bg-yellow-400 text-black border-yellow-400 shadow-md shadow-yellow-400/20 scale-105"
                        : "bg-zinc-200/60 dark:bg-zinc-900/80 text-zinc-600 dark:text-zinc-400 border-zinc-300/50 dark:border-zinc-800"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Estimated Expected Return Time Input & Quick Offsets */}
              <div className="space-y-2">
                <div className="relative flex items-center">
                  <Clock className="w-4 h-4 absolute left-4 text-zinc-400" />
                  <input
                    type="time"
                    required
                    value={returnTimeStr}
                    onChange={(e) => setReturnTimeStr(e.target.value)}
                    className="w-full bg-zinc-200/60 dark:bg-zinc-900/80 border border-zinc-300/50 dark:border-zinc-800 rounded-full pl-11 pr-5 py-3.5 text-xs font-extrabold text-black dark:text-white focus:outline-none focus:border-yellow-400 transition-all shadow-inner"
                  />
                </div>

                <div className="flex items-center space-x-2 pt-0.5">
                  <span className="text-[10px] font-bold text-zinc-400 px-1">Quick add delay:</span>
                  {[15, 30, 60, 120].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => addTimeMinutes(mins)}
                      className="px-2.5 py-1 rounded-full bg-zinc-200/80 dark:bg-zinc-800/80 border border-zinc-300/40 dark:border-zinc-700/60 text-[10px] font-bold text-zinc-700 dark:text-zinc-300 hover:border-yellow-400 active:scale-90 transition-all"
                    >
                      +{mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Requirement 3: Share Live Location With Guardians (With Loci Status Indicator) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <label className="block text-sm font-extrabold text-black dark:text-white">
                  Share live location with 🛡️
                </label>
                <span className="text-[10px] font-bold text-zinc-400">
                  {selectedContactIds.length} Selected
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1 rounded-full bg-zinc-200/70 dark:bg-zinc-900 p-1">
                <button
                  type="button"
                  onClick={() => setContactSelectionMode("individual")}
                  className={`rounded-full py-2 text-[10px] font-extrabold transition-colors ${contactSelectionMode === "individual" ? "bg-yellow-400 text-black" : "text-zinc-500 dark:text-zinc-400"}`}
                >
                  Individual Guardians
                </button>
                <button
                  type="button"
                  onClick={() => setContactSelectionMode("groups")}
                  className={`rounded-full py-2 text-[10px] font-extrabold transition-colors ${contactSelectionMode === "groups" ? "bg-yellow-400 text-black" : "text-zinc-500 dark:text-zinc-400"}`}
                >
                  Circle Groups
                </button>
              </div>

              {contacts.length === 0 ? (
                <div className="p-3.5 bg-zinc-200/60 dark:bg-zinc-900/60 border border-zinc-300/50 dark:border-zinc-800 rounded-2xl text-[11px] font-bold text-zinc-600 dark:text-zinc-400 flex items-center justify-between">
                  <span>⚠️ No contacts added yet.</span>
                  <button
                    type="button"
                    onClick={() => onNavigate("contacts")}
                    className="underline font-black text-black dark:text-white"
                  >
                    Add Circle
                  </button>
                </div>
              ) : contactSelectionMode === "groups" ? (
                <div className="flex items-center space-x-2.5 overflow-x-auto pb-1 scrollbar-none">
                  {contactGroups.length === 0 ? (
                    <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 px-1">No circle groups are assigned to your guardians.</p>
                  ) : contactGroups.map((group) => {
                    const groupContacts = contacts.filter((contact) => contact.group_category === group);
                    const isSelected = groupContacts.length > 0 && groupContacts.every((contact) => selectedContactIds.includes(contact.id));
                    return (
                      <button
                        key={group}
                        type="button"
                        onClick={() => {
                          groupContacts.forEach((contact) => {
                            const selected = selectedContactIds.includes(contact.id);
                            if (isSelected ? selected : !selected) toggleContactSelection(contact.id);
                          });
                        }}
                        className={`flex items-center space-x-2 px-3.5 py-2.5 rounded-full text-xs font-extrabold transition-all border shrink-0 active:scale-95 ${
                          isSelected
                            ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white shadow-sm"
                            : "bg-zinc-200/60 dark:bg-zinc-900/80 text-zinc-500 border-zinc-300/50 dark:border-zinc-800"
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${isSelected ? "bg-yellow-400 text-black" : "bg-zinc-300 dark:bg-zinc-800 text-transparent"}`}>
                          <Check className="w-2.5 h-2.5 stroke-3" />
                        </div>
                        <span>{group}</span>
                        <span className="text-[9px] opacity-70">{groupContacts.length}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center space-x-2.5 overflow-x-auto pb-1 scrollbar-none">
                  {contacts.map((c) => {
                    const isSelected = selectedContactIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleContactSelection(c.id)}
                        className={`flex items-center space-x-2 px-3.5 py-2.5 rounded-full text-xs font-extrabold transition-all border shrink-0 active:scale-95 ${
                          isSelected
                            ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white shadow-sm"
                            : "bg-zinc-200/60 dark:bg-zinc-900/80 text-zinc-500 border-zinc-300/50 dark:border-zinc-800"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full flex items-center justify-center ${
                            isSelected
                              ? "bg-yellow-400 text-black"
                              : "bg-zinc-300 dark:bg-zinc-800 text-transparent"
                          }`}
                        >
                          <Check className="w-2.5 h-2.5 stroke-3" />
                        </div>
                        <span>{c.name}</span>
                        {c.isLociUser && (
                          <span className="bg-yellow-400 text-black text-[9px] px-1.5 py-0.2 rounded-full font-black uppercase">
                            Loci
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Question 4: Selfie / Media Proof */}
            <div className="space-y-3">
              <label className="block text-sm font-extrabold text-black dark:text-white px-1">
                Selfie or Media Proof (Optional) 📸
              </label>

              {attachedMedia ? (
                <div className="relative rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 max-h-48 flex items-center justify-center group">
                  {attachedMedia.type === "image" ? (
                    <img
                      src={attachedMedia.previewUrl}
                      alt="Selfie proof"
                      className="w-full h-48 object-cover rounded-2xl"
                    />
                  ) : (
                    <div className="relative w-full h-48 bg-black flex items-center justify-center">
                      <video
                        src={attachedMedia.previewUrl}
                        className="w-full h-full object-cover rounded-2xl"
                      />
                      <Play className="w-8 h-8 text-white absolute fill-white opacity-80" />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={removeMedia}
                    className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-black/70 text-white backdrop-blur-md hover:bg-black active:scale-90 transition-all"
                    title="Remove attachment"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={startCamera}
                    className="flex items-center justify-center space-x-2 py-3.5 px-4 rounded-full bg-zinc-200/60 dark:bg-zinc-900/80 border border-zinc-300/50 dark:border-zinc-800 text-xs font-extrabold text-black dark:text-white hover:border-yellow-400/50 active:scale-95 transition-all"
                  >
                    <Camera className="w-4 h-4 text-zinc-400" />
                    <span>Take Selfie 🤳</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="flex items-center justify-center space-x-2 py-3.5 px-4 rounded-full bg-zinc-200/60 dark:bg-zinc-900/80 border border-zinc-300/50 dark:border-zinc-800 text-xs font-extrabold text-black dark:text-white hover:border-yellow-400/50 active:scale-95 transition-all"
                  >
                    <Paperclip className="w-4 h-4 text-zinc-400" />
                    <span>Upload Media 📁</span>
                  </button>
                </div>
              )}

              <input
                type="text"
                placeholder="Add extra details (e.g. Uber, Hyundai Accent)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-zinc-200/60 dark:bg-zinc-900/80 border border-zinc-300/50 dark:border-zinc-800 rounded-full px-5 py-3.5 text-xs font-semibold text-black dark:text-white focus:outline-none focus:border-yellow-400 transition-all shadow-inner"
              />
            </div>

            <button
              type="submit"
              disabled={sessionLoading}
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-extrabold py-4 rounded-full text-xs transition-all flex items-center justify-center space-x-1.5 active:scale-[0.97] disabled:opacity-40 shadow-lg shadow-yellow-400/20 mt-4"
            >
              {sessionLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-black" />
              ) : (
                <span>Start</span>
              )}
            </button>
          </form>
        </div>
      )}
    </>
  );
}