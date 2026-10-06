"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
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
  User,
  Zap,
  MessageSquare,
  ArrowRight,
  Shield,
  Sparkles,
  Radio,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { SatelliteMap } from "@/components/ui/satellite-map";
import { subscribeUserToPush } from "@/lib/push-notifications";

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
  user_reminder_mins?: number;
  contact_reminder_mins?: number;
  last_user_checkin_at?: string;
}

interface SessionCoordinates {
  latitude: number;
  longitude: number;
}

interface SessionPageProps {
  sessionHeadingSrc: string;
  userId: string | null;
  activeSession: ActiveSession | null;
  destination: string;
  setDestination: (v: string) => void;
  setDurationMinutes: (v: number | "") => void;
  userReminderMins: number | "";
  setUserReminderMins: (v: number | "") => void;
  contactReminderMins: number | "";
  setContactReminderMins: (v: number | "") => void;
  notes: string;
  setNotes: (v: string) => void;
  contacts: Contact[];
  selectedContactIds: string[];
  toggleContactSelection: (id: string) => void;
  sessionLoading: boolean;
  handleStartSession: (e: React.FormEvent, coordinates?: SessionCoordinates) => void;
  handleCompleteSession: () => void;
  handleSafeCheckin: () => void;
  onNavigate: (tab: "home" | "session" | "contacts" | "share" | "profile") => void;
}

export function SessionPage({
  sessionHeadingSrc,
  userId,
  activeSession,
  destination,
  setDestination,
  setDurationMinutes,
  userReminderMins,
  setUserReminderMins,
  contactReminderMins,
  setContactReminderMins,
  notes,
  setNotes,
  contacts,
  selectedContactIds,
  toggleContactSelection,
  sessionLoading,
  handleStartSession,
  handleCompleteSession,
  handleSafeCheckin,
  onNavigate,
}: SessionPageProps) {
  // 4-Step Setup Wizard
  // Step 1: Destination & GPS Pin
  // Step 2: Return Time & Day Schedule
  // Step 3: Self Check-In & Guardian Alert Intervals
  // Step 4: Guardian/Circle Selection & Optional Selfie/Notes
  const [currentStep, setCurrentStep] = useState<number>(1);

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

  const [contactSelectionMode, setContactSelectionMode] = useState<"individual" | "groups">("individual");
  const [clockNow, setClockNow] = useState(0);

  const [locationCoords, setLocationCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "requesting" | "granted" | "low-accuracy" | "denied">("idle");
  const [locationUpdatedAt, setLocationUpdatedAt] = useState<Date | null>(null);
  const [manuallyPickedLocation, setManuallyPickedLocation] = useState(false);
  const manuallyPickedLocationRef = useRef(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const locationWatchIdRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const sharedContacts = useMemo(
    () => contacts.filter((c) => selectedContactIds.includes(c.id)),
    [contacts, selectedContactIds]
  );
  const contactGroups = useMemo(
    () => Array.from(new Set(contacts.map((contact) => contact.group_category).filter((group): group is string => !!group))),
    [contacts]
  );

  const requestCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus("denied");
      return;
    }

    setLocationCoords(null);
    setLocationUpdatedAt(null);
    setManuallyPickedLocation(false);
    manuallyPickedLocationRef.current = false;
    setLocationStatus("requesting");
    if (locationWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(locationWatchIdRef.current);
    }
    locationWatchIdRef.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        if (manuallyPickedLocationRef.current) return;
        const latitude = coords.latitude;
        const longitude = coords.longitude;
        setLocationCoords({ latitude, longitude });
        setLocationUpdatedAt(new Date());
        setLocationStatus(coords.accuracy > 500 ? "low-accuracy" : "granted");

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
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 }
    );
  };

  const handleLocationPicked = (coordinates: SessionCoordinates) => {
    manuallyPickedLocationRef.current = true;
    setManuallyPickedLocation(true);
    setLocationCoords(coordinates);
    setLocationUpdatedAt(new Date());
    setLocationStatus("granted");
    if (locationWatchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(locationWatchIdRef.current);
      locationWatchIdRef.current = null;
    }

    if (activeSession && !activeSession.id.startsWith("local-")) {
      void supabase
        .from("checkin_sessions")
        .update({ current_lat: coordinates.latitude, current_lng: coordinates.longitude })
        .eq("id", activeSession.id)
        .eq("status", "active")
        .then(({ error }) => {
          if (error) console.error("Failed to update manually selected session location:", error);
        });
    }
  };

  useEffect(() => {
    if (!activeSession || manuallyPickedLocationRef.current) return;

    requestCurrentLocation();
    return () => {
      if (locationWatchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(locationWatchIdRef.current);
        locationWatchIdRef.current = null;
      }
    };
  }, [activeSession]);

  useEffect(() => () => {
    if (locationWatchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(locationWatchIdRef.current);
      locationWatchIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!activeSession || !("wakeLock" in navigator)) return;

    let disposed = false;
    const acquireWakeLock = async () => {
      if (disposed || document.visibilityState !== "visible") return;
      try {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      } catch (error) {
        console.warn("Screen Wake Lock unavailable:", error);
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && !wakeLockRef.current) void acquireWakeLock();
    };

    void acquireWakeLock();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      const lock = wakeLockRef.current;
      wakeLockRef.current = null;
      if (lock) void lock.release();
    };
  }, [activeSession?.id]);

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

  useEffect(() => {
    if (!targetEndTime) return;
    const updateTimer = () => {
      const diffSecs = Math.floor((targetEndTime - Date.now()) / 1000);
      setRemainingSeconds(Math.max(0, diffSecs));
      setClockNow(Date.now());
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [targetEndTime]);

  const formatTime = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    if (hrs > 0) {
      return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
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

  const isSafetyCheckinDue = !!activeSession && clockNow - new Date(
    activeSession.last_user_checkin_at || activeSession.expected_arrival_at
  ).getTime() >= (activeSession.user_reminder_mins || 15) * 60000;

  const handleWizardSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (currentStep !== 4 || sessionLoading) return;

    try {
      if (userId) {
        const result = await subscribeUserToPush(userId);
        if (!result.ok) console.warn("Push alerts may not reach this device:", result.reason);
      } else {
        console.warn("Push alerts could not be registered because the user profile is unavailable.");
      }
    } catch (error) {
      console.error("Push permission or subscription failed:", error);
    }

    handleStartSession(event, locationCoords || undefined);
  };

  return (
    <>
      {/* CAMERA OVERLAY */}
      {isCameraActive && (
        <div className="fixed inset-0 z-100 bg-black flex flex-col justify-between p-4 max-w-md mx-auto">
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
            <div className="flex items-center justify-start">
              <button
                onClick={() => onNavigate("home")}
                className="p-2.5 rounded-full bg-zinc-200/60 dark:bg-zinc-900/60 backdrop-blur-xl text-black dark:text-white active:scale-90 transition-all shadow-sm flex items-center space-x-1.5 pr-4 border border-zinc-300/40 dark:border-zinc-800/50"
              >
                <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                <span className="text-xs font-bold">Home</span>
              </button>
            </div>

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
                      title={`${c.name} (${c.isLociUser ? "Déloci Guardian Active" : "SMS Alert Ready"})`}
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

            <div className="flex items-center justify-center py-4">
              <span className="font-mono font-black text-6xl sm:text-7xl tracking-tighter scale-y-[1.3] text-yellow-400 select-none drop-shadow-[0_4px_16px_rgba(250,204,21,0.25)]">
                {formatTime(remainingSeconds)}
              </span>
            </div>

            <div className="flex flex-col items-center text-center space-y-2.5 px-4">
              {isSafetyCheckinDue ? (
                <button
                  type="button"
                  onClick={handleSafeCheckin}
                  className="w-full max-w-sm bg-yellow-400 hover:bg-yellow-300 text-black px-5 py-4 rounded-2xl font-black text-base shadow-lg shadow-yellow-400/30 active:scale-[0.98]"
                >
                  Confirm I’m Safe
                </button>
              ) : (
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 max-w-xs leading-relaxed">
                  Safety check-in every {activeSession.user_reminder_mins || 15} minutes. Guardian alert {activeSession.contact_reminder_mins || 30} minutes after expected arrival.
                </p>
              )}
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
                                ? "Acquiring High-Precision GPS..."
                              : "Waiting for GPS permission"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={requestCurrentLocation}
                    className="shrink-0 text-[10px] font-extrabold text-black dark:text-white px-3 py-2 rounded-full bg-yellow-400 hover:bg-yellow-300 transition-colors"
                  >
                    {locationStatus === "low-accuracy"
                      ? "Enable high accuracy"
                      : locationStatus === "requesting"
                        ? "Acquiring..."
                        : locationStatus === "granted"
                          ? "Refresh"
                          : "Enable location"}
                  </button>
                </div>
                {locationStatus === "low-accuracy" && (
                  <p className="px-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                    GPS accuracy is over 500 m. Enable precise location in settings.
                  </p>
                )}
                {locationUpdatedAt && (
                  <p className="text-[9px] text-zinc-400">
                    Updated {locationUpdatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
              </div>

              {locationCoords && (
                <SatelliteMap
                  latitude={locationCoords.latitude}
                  longitude={locationCoords.longitude}
                  interactive
                  manuallyPicked={manuallyPickedLocation}
                  onLocationChange={handleLocationPicked}
                />
              )}
            </div>
          </div>

          <div className="pb-6">
            <button
              onClick={handleCompleteSession}
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
        </div>
      ) : (
        /* 4-STEP WIZARD PAGEVIEW */
        <div className="pt-[max(0.5rem,env(safe-area-inset-top))] space-y-4 max-w-md mx-auto min-h-[82vh] flex flex-col justify-between">
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleGallerySelect}
            className="hidden"
          />

          {/* Header & Step Indicator */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => {
                  if (currentStep > 1) setCurrentStep((s) => s - 1);
                  else onNavigate("home");
                }}
                className="p-2.5 rounded-full bg-zinc-200/70 dark:bg-zinc-800/80 backdrop-blur-xl text-black dark:text-white active:scale-90 transition-all shadow-sm border border-zinc-300/40 dark:border-zinc-800/50"
              >
                <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
              </button>

              <img
                src={sessionHeadingSrc}
                alt="Session Heading"
                className="h-10 w-auto object-contain"
              />

              <div className="w-9" />
            </div>

            {/* Segmented 4-Step Bar */}
            <div className="space-y-1.5 px-1">
              <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-zinc-400">
                <span>
                  {currentStep === 1 && "1. Route & GPS Pin"}
                  {currentStep === 2 && "2. Schedule Return"}
                  {currentStep === 3 && "3. Reminder Intervals"}
                  {currentStep === 4 && "4. Guardians, Selfie & Notes"}
                </span>
                <span>Step {currentStep} of 4</span>
              </div>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4].map((step) => (
                  <div
                    key={step}
                    className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                      step <= currentStep ? "bg-yellow-400 shadow-sm" : "bg-zinc-200 dark:bg-zinc-800"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          <form
            onSubmit={handleWizardSubmit}
            className="flex-1 flex flex-col justify-between"
          >
            {/* Sliding Container */}
            <div className="overflow-hidden relative flex-1 py-2">
              <div
                className="flex transition-transform duration-300 ease-out h-full"
                style={{ transform: `translateX(-${(currentStep - 1) * 100}%)` }}
              >
                {/* STEP 1: DESTINATION & MAP */}
                <div className="w-full shrink-0 space-y-5 px-1">
                  <div className="space-y-1">
                    <h2 className="text-lg font-black text-black dark:text-white flex items-center gap-2">
                      <span>Where are you heading?</span>
                      <MapPin className="w-5 h-5 text-yellow-400" />
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Specify your destination address and set departure GPS.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-extrabold text-black dark:text-white">
                      Destination Address / Route
                    </label>
                    <div className="relative flex items-center">
                      <MapPin className="w-4 h-4 absolute left-4 text-zinc-400" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. Osu Oxford Street or Home"
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        className="w-full bg-zinc-200/60 dark:bg-zinc-900/80 border border-zinc-300/50 dark:border-zinc-800 rounded-2xl pl-11 pr-5 py-4 text-xs font-semibold text-black dark:text-white focus:outline-none focus:border-yellow-400 transition-all shadow-inner"
                      />
                    </div>
                  </div>

                  <div className="space-y-2.5 pt-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-black dark:text-white">Starting Pin Location</p>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                          {locationCoords
                            ? `${locationCoords.latitude.toFixed(5)}, ${locationCoords.longitude.toFixed(5)}`
                            : "Enable GPS to capture departure point"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={requestCurrentLocation}
                        className="shrink-0 bg-yellow-400 text-black font-extrabold px-3.5 py-2 rounded-full text-[10px] active:scale-95 transition-all shadow-sm"
                      >
                        {locationStatus === "requesting" ? "Acquiring..." : "Use device GPS"}
                      </button>
                    </div>

                    {locationCoords && (
                      <SatelliteMap
                        latitude={locationCoords.latitude}
                        longitude={locationCoords.longitude}
                        interactive
                        manuallyPicked={manuallyPickedLocation}
                        onLocationChange={handleLocationPicked}
                      />
                    )}
                  </div>
                </div>

                {/* STEP 2: RETURN TIME & DAY */}
                <div className="w-full shrink-0 space-y-5 px-1">
                  <div className="space-y-1">
                    <h2 className="text-lg font-black text-black dark:text-white flex items-center gap-2">
                      <span>When are you returning?</span>
                      <Clock className="w-5 h-5 text-yellow-400" />
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Pick your return day and target arrival time.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-xs font-extrabold text-black dark:text-white">
                      Expected Return Day
                    </label>
                    <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
                      {dayOptions.map((opt) => (
                        <button
                          key={opt.offset}
                          type="button"
                          onClick={() => setSelectedDayOffset(opt.offset)}
                          className={`px-3.5 py-2.5 rounded-2xl text-xs font-extrabold shrink-0 transition-all border ${
                            selectedDayOffset === opt.offset
                              ? "bg-yellow-400 text-black border-yellow-400 shadow-md shadow-yellow-400/20 scale-105"
                              : "bg-zinc-200/60 dark:bg-zinc-900/80 text-zinc-600 dark:text-zinc-400 border-zinc-300/50 dark:border-zinc-800"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-extrabold text-black dark:text-white">
                      Return Time
                    </label>
                    <div className="relative flex items-center">
                      <Clock className="w-4 h-4 absolute left-4 text-zinc-400" />
                      <input
                        type="time"
                        required
                        value={returnTimeStr}
                        onChange={(e) => setReturnTimeStr(e.target.value)}
                        className="w-full bg-zinc-200/60 dark:bg-zinc-900/80 border border-zinc-300/50 dark:border-zinc-800 rounded-2xl pl-11 pr-5 py-4 text-xs font-extrabold text-black dark:text-white focus:outline-none focus:border-yellow-400 transition-all shadow-inner"
                      />
                    </div>

                    <div className="flex items-center space-x-2 pt-1">
                      <span className="text-[10px] font-bold text-zinc-400">Quick add:</span>
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

                {/* STEP 3: CHECK-IN & ALERT TIMERS */}
                <div className="w-full shrink-0 space-y-5 px-1">
                  <div className="space-y-1">
                    <h2 className="text-lg font-black text-black dark:text-white flex items-center gap-2">
                      <span>Safety Timers & Alerts</span>
                      <Radio className="w-5 h-5 text-yellow-400" />
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Configure check-in prompt intervals and guardian escalation grace period.
                    </p>
                  </div>

                  <div className="space-y-4 pt-1">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-extrabold text-black dark:text-white">
                        Self Check-In Frequency (Minutes)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="1440"
                        required
                        value={userReminderMins}
                        onChange={(event) => setUserReminderMins(event.target.value ? Number(event.target.value) : "")}
                        className="w-full bg-zinc-200/60 dark:bg-zinc-900/80 border border-zinc-300/50 dark:border-zinc-800 rounded-2xl px-4 py-3.5 text-xs font-semibold text-black dark:text-white focus:outline-none focus:border-yellow-400"
                      />
                      <p className="text-[10px] text-zinc-500">How often your phone asks "Confirm I'm safe".</p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-extrabold text-black dark:text-white">
                        Guardian Escalation Grace Period (Minutes)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="1440"
                        required
                        value={contactReminderMins}
                        onChange={(event) => setContactReminderMins(event.target.value ? Number(event.target.value) : "")}
                        className="w-full bg-zinc-200/60 dark:bg-zinc-900/80 border border-zinc-300/50 dark:border-zinc-800 rounded-2xl px-4 py-3.5 text-xs font-semibold text-black dark:text-white focus:outline-none focus:border-yellow-400"
                      />
                      <p className="text-[10px] text-zinc-500">Grace period after missed return time before guardians are alerted.</p>
                    </div>
                  </div>
                </div>

                {/* STEP 4: GUARDIANS, SELFIE & NOTES */}
                <div className="w-full shrink-0 space-y-5 px-1">
                  <div className="space-y-1">
                    <h2 className="text-lg font-black text-black dark:text-white flex items-center gap-2">
                      <span>Choose Guardians</span>
                      <Shield className="w-5 h-5 text-yellow-400" />
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Select individual contacts or entire circle groups to monitor your journey.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-extrabold text-black dark:text-white">
                        Recipients
                      </label>
                      <span className="text-[10px] font-bold text-zinc-400">
                        {selectedContactIds.length} Selected
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1 rounded-full bg-zinc-200/70 dark:bg-zinc-900 p-1">
                      <button
                        type="button"
                        onClick={() => setContactSelectionMode("individual")}
                        className={`rounded-full py-1.5 text-[10px] font-extrabold transition-colors ${contactSelectionMode === "individual" ? "bg-yellow-400 text-black" : "text-zinc-500 dark:text-zinc-400"}`}
                      >
                        Individual
                      </button>
                      <button
                        type="button"
                        onClick={() => setContactSelectionMode("groups")}
                        className={`rounded-full py-1.5 text-[10px] font-extrabold transition-colors ${contactSelectionMode === "groups" ? "bg-yellow-400 text-black" : "text-zinc-500 dark:text-zinc-400"}`}
                      >
                        Circle Groups
                      </button>
                    </div>

                    {contacts.length === 0 ? (
                      <div className="p-3 bg-zinc-200/60 dark:bg-zinc-900/60 border border-zinc-300/50 dark:border-zinc-800 rounded-2xl text-[11px] font-bold text-zinc-600 dark:text-zinc-400 flex items-center justify-between">
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
                      <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
                        {contactGroups.map((group) => {
                          const groupContacts = contacts.filter((c) => c.group_category === group);
                          const isSelected = groupContacts.length > 0 && groupContacts.every((c) => selectedContactIds.includes(c.id));
                          return (
                            <button
                              key={group}
                              type="button"
                              onClick={() => {
                                groupContacts.forEach((c) => {
                                  const sel = selectedContactIds.includes(c.id);
                                  if (isSelected ? sel : !sel) toggleContactSelection(c.id);
                                });
                              }}
                              className={`flex items-center space-x-2 px-3.5 py-2.5 rounded-2xl text-xs font-extrabold transition-all border shrink-0 ${
                                isSelected
                                  ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white shadow-sm"
                                  : "bg-zinc-200/60 dark:bg-zinc-900/80 text-zinc-500 border-zinc-300/50 dark:border-zinc-800"
                              }`}
                            >
                              <div className={`w-4 h-4 rounded-full flex items-center justify-center ${isSelected ? "bg-yellow-400 text-black" : "bg-zinc-300 dark:bg-zinc-800 text-transparent"}`}>
                                <Check className="w-2.5 h-2.5 stroke-3" />
                              </div>
                              <span>{group}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
                        {contacts.map((c) => {
                          const isSelected = selectedContactIds.includes(c.id);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => toggleContactSelection(c.id)}
                              className={`flex items-center space-x-2 px-3.5 py-2.5 rounded-2xl text-xs font-extrabold transition-all border shrink-0 ${
                                isSelected
                                  ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white shadow-sm"
                                  : "bg-zinc-200/60 dark:bg-zinc-900/80 text-zinc-500 border-zinc-300/50 dark:border-zinc-800"
                              }`}
                            >
                              <div className={`w-4 h-4 rounded-full flex items-center justify-center ${isSelected ? "bg-yellow-400 text-black" : "bg-zinc-300 dark:bg-zinc-800 text-transparent"}`}>
                                <Check className="w-2.5 h-2.5 stroke-3" />
                              </div>
                              <span>{c.name}</span>
                              {c.isLociUser && (
                                <span className="bg-yellow-400 text-black text-[9px] px-1.5 py-0.2 rounded-full font-black uppercase">
                                  Déloci
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* OPTIONAL SELFIE & NOTES */}
                  <div className="space-y-2.5">
                    <label className="block text-xs font-extrabold text-black dark:text-white">
                      Selfie / Proof & Notes (Optional)
                    </label>

                    {attachedMedia ? (
                      <div className="relative rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 h-28 flex items-center justify-center">
                        {attachedMedia.type === "image" ? (
                          <img src={attachedMedia.previewUrl} alt="Selfie proof" className="w-full h-full object-cover" />
                        ) : (
                          <div className="relative w-full h-full bg-black flex items-center justify-center">
                            <video src={attachedMedia.previewUrl} className="w-full h-full object-cover" />
                            <Play className="w-8 h-8 text-white absolute fill-white opacity-80" />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={removeMedia}
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white backdrop-blur-md"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={startCamera}
                          className="flex items-center justify-center space-x-2 py-2.5 px-3 rounded-2xl bg-zinc-200/60 dark:bg-zinc-900/80 border border-zinc-300/50 dark:border-zinc-800 text-xs font-extrabold text-black dark:text-white"
                        >
                          <Camera className="w-4 h-4 text-zinc-400" />
                          <span>Selfie 🤳</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => galleryInputRef.current?.click()}
                          className="flex items-center justify-center space-x-2 py-2.5 px-3 rounded-2xl bg-zinc-200/60 dark:bg-zinc-900/80 border border-zinc-300/50 dark:border-zinc-800 text-xs font-extrabold text-black dark:text-white"
                        >
                          <Paperclip className="w-4 h-4 text-zinc-400" />
                          <span>Upload 📁</span>
                        </button>
                      </div>
                    )}

                    <input
                      type="text"
                      placeholder="e.g. Uber, License Plate GW-4920-22"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full bg-zinc-200/60 dark:bg-zinc-900/80 border border-zinc-300/50 dark:border-zinc-800 rounded-2xl px-4 py-3 text-xs font-semibold text-black dark:text-white focus:outline-none focus:border-yellow-400"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Wizard Action Bar */}
            <div className="pt-4 pb-4 flex items-center gap-3">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={() => setCurrentStep((s) => s - 1)}
                  className="px-5 py-4 rounded-full bg-zinc-200 dark:bg-zinc-800 text-black dark:text-white text-xs font-black active:scale-95 transition-all"
                >
                  Back
                </button>
              )}

              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (currentStep === 1 && !destination.trim()) {
                      alert("Please enter a destination before proceeding.");
                      return;
                    }
                    setCurrentStep((s) => s + 1);
                  }}
                  className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-black font-extrabold py-4 rounded-full text-xs transition-all flex items-center justify-center space-x-2 active:scale-95 shadow-lg shadow-yellow-400/20"
                >
                  <span>Next Step</span>
                  <ArrowRight className="w-4 h-4 stroke-3" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={sessionLoading}
                  className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-black font-extrabold py-4 rounded-full text-xs transition-all flex items-center justify-center space-x-2 active:scale-95 disabled:opacity-40 shadow-lg shadow-yellow-400/20"
                >
                  {sessionLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-black" />
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-black fill-black" />
                      <span>Start Watch Session</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </>
  );
}