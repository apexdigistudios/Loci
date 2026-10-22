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
  User,
  Zap,
  MessageSquare,
  ArrowRight,
  Shield,
  Sparkles,
  Radio,
  AlertTriangle,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { normalizePhone } from "@/lib/utils";
import { SatelliteMap } from "@/components/ui/satellite-map";
import { subscribeUserToPush } from "@/lib/push-notifications";
import { dispatchAlert } from "@/lib/alerts";
import { useSubscription } from "@/hooks/use-subscription";

interface Contact {
  id: string;
  name: string;
  phone: string;
  isLociUser?: boolean;
  avatar_url?: string;
  group_category?: string;
  contact_user_id?: string;
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
  userPhone?: string;
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
  handleStartSession: (e: React.FormEvent, coordinates?: SessionCoordinates) => void | Promise<boolean>;
  handleCompleteSession: () => void | Promise<boolean>;
  handleSafeCheckin: () => void | Promise<boolean>;
  onSosTriggered: (
    sessionId: string | undefined,
    coordinates: SessionCoordinates | null
  ) => void;
  onNavigate: (tab: "home" | "session" | "contacts" | "share" | "profile") => void;
}

interface SuggestionItem {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export function SessionPage({
  sessionHeadingSrc,
  userId,
  userPhone,
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
  onSosTriggered,
  onNavigate,
}: SessionPageProps) {
  const { tier } = useSubscription(userId || undefined);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isCheckingIn, setIsCheckingIn] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState("");
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | undefined>(undefined);

  const [stagedMedia, setStagedMedia] = useState<{
    file: File;
    previewUrl: string;
    type: "image" | "video";
  } | null>(null);

  const [attachedMedia, setAttachedMedia] = useState<{
    file: File;
    previewUrl: string;
    type: "image" | "video";
  } | null>(null);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isMapFullScreen, setIsMapFullScreen] = useState(false);

  const [showSosModal, setShowSosModal] = useState(false);
  const [sosSending, setSosSending] = useState(false);

  const [selectedDayOffset, setSelectedDayOffset] = useState<number>(0);
  const [returnTimeStr, setReturnTimeStr] = useState<string>(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30);
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  });

  const [targetEndTime, setTargetEndTime] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [clockNow, setClockNow] = useState(0);

  const [contactSelectionMode, setContactSelectionMode] = useState<"individual" | "groups">("individual");

  const [locationCoords, setLocationCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationAddress, setLocationAddress] = useState<string>("");
  const [locationStatus, setLocationStatus] = useState<"idle" | "requesting" | "granted" | "low-accuracy" | "denied">("idle");
  const [locationUpdatedAt, setLocationUpdatedAt] = useState<Date | null>(null);
  const [manuallyPickedLocation, setManuallyPickedLocation] = useState(false);
  const manuallyPickedLocationRef = useRef(false);
  const [detectedCountryCode, setDetectedCountryCode] = useState<string>("");

  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const lastCheckinPushRef = useRef<number>(0);
  const lastExpiryPushRef = useRef<boolean>(false);
  const lastGuardianOverduePushRef = useRef<boolean>(false);
  const alertedSessionIdRef = useRef<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const locationWatchIdRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const persistSessionLocation = useCallback(async (
    sessionId: string,
    coordinates: SessionCoordinates,
    address: string,
    isSos: boolean
  ) => {
    const { data, error } = await supabase
      .from("checkin_sessions")
      .update({
        current_lat: coordinates.latitude,
        current_lng: coordinates.longitude,
        metadata: {
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          address,
          updated_at: new Date().toISOString(),
          is_sos: isSos,
        },
      })
      .eq("id", sessionId)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Failed to publish live session location:", error);
    } else if (!data) {
      console.error("Live session location was not saved; the session row was not visible to the sender.");
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    void supabase
      .from("users")
      .select("avatar_url")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        if (data?.avatar_url) setUserAvatarUrl(data.avatar_url);
      });
  }, [userId]);

  const sharedContacts = useMemo(
    () => contacts.filter((c) => selectedContactIds.includes(c.id)),
    [contacts, selectedContactIds]
  );

  const guardianUserIds = useMemo(
    () => Array.from(new Set(sharedContacts.flatMap((contact) => {
      const contactUserId = contact.contact_user_id?.trim();
      if (contactUserId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(contactUserId)) {
        return [contactUserId];
      }

      const phone = normalizePhone(contact.phone);
      return /^\+\d{8,15}$/.test(phone) ? [phone] : [];
    }))),
    [sharedContacts]
  );

  const contactGroups = useMemo(
    () => Array.from(new Set(contacts.map((contact) => contact.group_category).filter((group): group is string => !!group))),
    [contacts]
  );

  useEffect(() => {
    if (!locationCoords) return;
    const fetchLocationDetails = async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${locationCoords.latitude}&lon=${locationCoords.longitude}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.address?.country_code) {
            setDetectedCountryCode(data.address.country_code.toLowerCase());
          }
          if (data?.display_name) {
            setLocationAddress(data.display_name);
          }
        }
      } catch (err) {
        console.error("Failed to fetch location details:", err);
      }
    };
    void fetchLocationDetails();
  }, [locationCoords]);

  useEffect(() => {
    if (!destination || destination.trim().length < 2 || !showSuggestions) {
      const frameId = window.requestAnimationFrame(() => setSuggestions([]));
      return () => window.cancelAnimationFrame(frameId);
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsFetchingSuggestions(true);
      try {
        let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          destination.trim()
        )}&limit=5`;

        if (detectedCountryCode) {
          url += `&countrycodes=${detectedCountryCode}`;
        }

        if (locationCoords && !detectedCountryCode) {
          const minLon = locationCoords.longitude - 3;
          const maxLat = locationCoords.latitude + 3;
          const maxLon = locationCoords.longitude + 3;
          const minLat = locationCoords.latitude - 3;
          url += `&viewbox=${minLon},${maxLat},${maxLon},${minLat}&bounded=0`;
        }

        const res = await fetch(url, { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data);
        }
      } catch (err: unknown) {
        if ((err as Error)?.name !== "AbortError") {
          console.error("Failed to fetch location suggestions:", err);
        }
      } finally {
        setIsFetchingSuggestions(false);
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [destination, showSuggestions, locationCoords, detectedCountryCode]);

  const requestCurrentLocation = useCallback(() => {
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
        if (manuallyPickedLocationRef.current) return;
        const latitude = coords.latitude;
        const longitude = coords.longitude;

        setLocationCoords({ latitude, longitude });
        setLocationUpdatedAt(new Date());
        setLocationStatus(coords.accuracy > 500 ? "low-accuracy" : "granted");

        if (activeSession && !activeSession.id.startsWith("local-")) {
          void persistSessionLocation(
            activeSession.id,
            { latitude, longitude },
            locationAddress,
            activeSession.status === "escalated"
          );
        }
      },
      () => setLocationStatus("denied"),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 }
    );
  }, [activeSession, locationAddress, persistSessionLocation]);

  useEffect(() => {
    if (!activeSession) return;

    const sosInterval = setInterval(() => {
      if (navigator.geolocation && !manuallyPickedLocationRef.current) {
        navigator.geolocation.getCurrentPosition(async ({ coords }) => {
          const latitude = coords.latitude;
          const longitude = coords.longitude;
          setLocationCoords({ latitude, longitude });

          if (!activeSession.id.startsWith("local-")) {
            await persistSessionLocation(
              activeSession.id,
              { latitude, longitude },
              locationAddress,
              activeSession.status === "escalated"
            );
          }
        }, (err) => console.error("Continuous location broadcast error:", err), { enableHighAccuracy: true });
      }
    }, 4000);

    return () => clearInterval(sosInterval);
  }, [activeSession, locationAddress, persistSessionLocation]);

  useEffect(() => {
    requestCurrentLocation();
    const refreshInterval = setInterval(() => {
      requestCurrentLocation();
    }, 5 * 60 * 1000);

    return () => {
      clearInterval(refreshInterval);
      if (locationWatchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(locationWatchIdRef.current);
        locationWatchIdRef.current = null;
      }
    };
  }, [requestCurrentLocation]);

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
      void persistSessionLocation(
        activeSession.id,
        coordinates,
        locationAddress,
        activeSession.status === "escalated"
      );
    }
  };

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
  }, [activeSession]);

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
    const frameId = window.requestAnimationFrame(() => {
      if (activeSession?.expected_arrival_at) {
        setTargetEndTime(new Date(activeSession.expected_arrival_at).getTime());
      } else {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + selectedDayOffset);
        const [hours, minutes] = returnTimeStr.split(":").map(Number);
        if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
          targetDate.setHours(hours, minutes, 0, 0);
        }
        const calculatedMinutes = Math.max(1, Math.round((targetDate.getTime() - Date.now()) / 60000));

        if (tier === "free" && (selectedDayOffset > 0 || calculatedMinutes > 1440)) {
          setActionMessage("Free users' active sessions can last for up to 1 day only. Upgrade to Plus for unlimited duration!");
          setSelectedDayOffset(0);
          return;
        }

        setDurationMinutes(calculatedMinutes);
        setTargetEndTime(targetDate.getTime());
      }
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [selectedDayOffset, returnTimeStr, activeSession, setDurationMinutes, tier]);

  useEffect(() => {
    if (!targetEndTime) return;
    const updateTimer = () => {
      const now = Date.now();
      const diffSecs = Math.floor((targetEndTime - now) / 1000);
      setClockNow(now);
      setRemainingSeconds(Math.max(0, diffSecs));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [targetEndTime]);

  const isSafetyCheckinDue = !!activeSession && clockNow - new Date(
    activeSession.last_user_checkin_at || activeSession.expected_arrival_at
  ).getTime() >= (activeSession.user_reminder_mins || 15) * 60000;

  useEffect(() => {
    if (!activeSession || activeSession.status !== "active") return;

    if (alertedSessionIdRef.current !== activeSession.id) {
      alertedSessionIdRef.current = activeSession.id;
      lastCheckinPushRef.current = 0;
      lastExpiryPushRef.current = false;
      lastGuardianOverduePushRef.current = false;
    }

    const evaluateSafetyAlerts = () => {
      const now = Date.now();
      const lastCheckinAt = new Date(
        activeSession.last_user_checkin_at || activeSession.expected_arrival_at
      ).getTime();
      const reminderInterval = (activeSession.user_reminder_mins || 15) * 60000;

      if (Number.isFinite(lastCheckinAt) && now - lastCheckinAt >= reminderInterval
        && now - lastCheckinPushRef.current > 120000) {
        lastCheckinPushRef.current = now;
        void dispatchAlert({
          userIds: userId || "",
          title: "Safety Check-In Required",
          message: `Please confirm you are safe on your trip to ${activeSession.destination || "your destination"}.`,
          type: "checkin",
          sessionId: activeSession.id,
        });
      }

      const expectedArrival = new Date(activeSession.expected_arrival_at).getTime();
      if (Number.isFinite(expectedArrival) && now >= expectedArrival && !lastExpiryPushRef.current) {
        lastExpiryPushRef.current = true;
        void dispatchAlert({
          userIds: userId || "",
          title: "Expected Arrival Time Reached",
          message: "Your session target arrival time has passed.",
          type: "emergency",
          sessionId: activeSession.id,
        });
      }

      const guardianGraceMins = activeSession.contact_reminder_mins || 30;
      const guardianAlertTime = expectedArrival + guardianGraceMins * 60000;
      if (Number.isFinite(guardianAlertTime) && now >= guardianAlertTime && !lastGuardianOverduePushRef.current) {
        lastGuardianOverduePushRef.current = true;
        void dispatchAlert({
          userIds: userId || "",
          title: "Guardian Alert Escalated",
          message: "You have not ended your session. Your guardians have been alerted.",
          type: "guardian_alert",
          sessionId: activeSession.id,
        });
        void dispatchAlert({
          userIds: guardianUserIds,
          title: "Emergency: Session Overdue",
          message: `Safety session to ${activeSession.destination || "destination"} is overdue and its grace period expired without a safe check-in.`,
          type: "emergency",
          url: "/main?tab=contacts",
          sessionId: activeSession.id,
          metadata: { destination: activeSession.destination, address: locationAddress },
        });
      }
    };

    const evaluateWhenVisible = () => {
      if (document.visibilityState === "visible") evaluateSafetyAlerts();
    };
    evaluateSafetyAlerts();
    const interval = window.setInterval(evaluateSafetyAlerts, 15000);
    document.addEventListener("visibilitychange", evaluateWhenVisible);
    window.addEventListener("focus", evaluateSafetyAlerts);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", evaluateWhenVisible);
      window.removeEventListener("focus", evaluateSafetyAlerts);
    };
  }, [activeSession, userId, guardianUserIds, locationAddress]);

  const handleCheckInClick = async () => {
    if (isCheckingIn) return;
    setIsCheckingIn(true);
    setActionMessage("");
    try {
      lastCheckinPushRef.current = 0;
      const checkinSaved = await Promise.resolve(handleSafeCheckin());
      if (checkinSaved === false) {
        setActionMessage("We couldn’t save your check-in. Check your connection and try again. Your session is still active.");
        return;
      }

      void dispatchAlert({
        userIds: userId || "",
        title: "Check-In Confirmed",
        message: "You have successfully confirmed you are safe.",
        type: "checkin",
        sessionId: activeSession?.id,
      });

      if (guardianUserIds.length > 0) {
        void dispatchAlert({
          userIds: guardianUserIds,
          title: "Guardian Check-In Update",
          message: `Your contact has checked in safely for their trip to ${activeSession?.destination || "their destination"}.`,
          type: "checkin",
          url: "/main?tab=contacts",
          sessionId: activeSession?.id,
          playFeedback: false,
          showLocal: false,
        });
      }
    } catch (error) {
      console.error("Check-in action failed:", error);
      setActionMessage("We couldn’t save your check-in just now. Please try again. Your session is still active.");
    } finally {
      setTimeout(() => setIsCheckingIn(false), 800);
    }
  };

  const onEndSessionClick = async () => {
    setActionMessage("");
    try {
      const sessionEnded = await Promise.resolve(handleCompleteSession());
      if (sessionEnded === false) {
        setActionMessage("We couldn’t end your session just now. Check your connection and try again.");
        return;
      }
    } catch (error) {
      console.error("Session end action failed:", error);
      setActionMessage("We couldn’t end your session just now. Please try again.");
      return;
    }

    void dispatchAlert({
      userIds: userId || "",
      title: "Session Ended Successfully",
      message: "Your safety watch session has been completed and closed.",
      type: "session_end",
      sessionId: activeSession?.id,
    });

    if (guardianUserIds.length > 0) {
      void dispatchAlert({
        userIds: guardianUserIds,
        title: "Session Ended Safely",
        message: `The safety session heading to ${activeSession?.destination || destination || "destination"} has ended.`,
        type: "session_end",
        url: "/main?tab=contacts",
        sessionId: activeSession?.id,
        playFeedback: false,
        showLocal: false,
      });
    }
  };

  const handleTriggerSos = async () => {
    if (sosSending) return;
    const sosCountKey = `deloci_sos_uses_${userId || "guest"}`;
    const usedSos = Math.max(0, Number(localStorage.getItem(sosCountKey) || "0") || 0);

    if (tier === "free" && usedSos >= 3) {
      setActionMessage("Free users can only use Emergency SOS 3 times. Upgrade to Plus for unlimited emergency broadcasts!");
      setShowSosModal(false);
      return;
    }

    setSosSending(true);
    try {
      let sosCoordinates = locationCoords;
      let sosAccuracy: number | null = null;
      let hasFreshLocation = false;

      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              maximumAge: 0,
              timeout: 8000,
            });
          });
          const { latitude, longitude, accuracy } = position.coords;
          if (Number.isFinite(latitude) && Number.isFinite(longitude)
            && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
            sosCoordinates = { latitude, longitude };
            sosAccuracy = Number.isFinite(accuracy) ? accuracy : null;
            hasFreshLocation = true;
            setLocationCoords(sosCoordinates);
            setLocationUpdatedAt(new Date(position.timestamp));
            setLocationStatus(accuracy > 500 ? "low-accuracy" : "granted");
          }
        } catch (error) {
          console.warn("Could not get a fresh GPS fix for SOS:", error);
        }
      }

      const cachedLocationIsRecent = locationUpdatedAt !== null
        && Date.now() - locationUpdatedAt.getTime() <= 2 * 60 * 1000;
      if (!hasFreshLocation && !cachedLocationIsRecent) sosCoordinates = null;

      const sosAddress = hasFreshLocation ? "" : locationAddress;
      const coordinateText = sosCoordinates
        ? `${sosCoordinates.latitude.toFixed(6)}, ${sosCoordinates.longitude.toFixed(6)}${sosAccuracy !== null ? ` (GPS accuracy +/-${Math.round(sosAccuracy)}m)` : ""}`
        : "GPS unavailable";
      const sosMessage = `URGENT: Emergency SOS triggered! Current Location: ${sosAddress || coordinateText}`;
      const sosMetadata = {
        latitude: sosCoordinates?.latitude ?? null,
        longitude: sosCoordinates?.longitude ?? null,
        accuracy_m: sosAccuracy,
        address: sosAddress || null,
        type: "emergency",
        is_sos: true,
        updated_at: new Date().toISOString(),
      };

      let targetSessionId = activeSession?.id && !activeSession.id.startsWith("local-")
        ? activeSession.id
        : undefined;
      let persistenceWarning = "";

      if (userId) {
        try {
          if (targetSessionId) {
            const { data, error } = await supabase
              .from("checkin_sessions")
              .update({
                status: "escalated",
                notes: sosMessage,
                metadata: sosMetadata,
                current_lat: sosCoordinates?.latitude ?? null,
                current_lng: sosCoordinates?.longitude ?? null,
              })
              .eq("id", targetSessionId)
              .select("id")
              .maybeSingle();
            if (error) throw error;
            if (!data) throw new Error("The active session could not be updated.");
          } else {
            const expectedArrival = new Date(Date.now() + 24 * 3600000).toISOString();
            const { data: newSession, error } = await supabase
              .from("checkin_sessions")
              .insert({
                user_id: userId,
                user_phone: userPhone || "",
                destination: "EMERGENCY SOS",
                expected_arrival_at: expectedArrival,
                status: "escalated",
                notes: sosMessage,
                metadata: sosMetadata,
                current_lat: sosCoordinates?.latitude ?? null,
                current_lng: sosCoordinates?.longitude ?? null,
              })
              .select("id")
              .single();
            if (error) throw error;
            targetSessionId = newSession.id;

            if (sharedContacts.length > 0) {
              const { error: recipientError } = await supabase.from("session_recipients").insert(
                sharedContacts.map((contact) => ({
                  session_id: newSession.id,
                  recipient_phone: contact.phone,
                  contact_phone: contact.phone,
                }))
              );
              if (recipientError) throw recipientError;
            }
          }
        } catch (error) {
          console.error("Failed to persist SOS session:", error);
          persistenceWarning = " The live session could not be saved.";
          if (activeSession?.id.startsWith("local-")) targetSessionId = undefined;
        }
      }

      const alertRequests = [
        ...(userId ? [{
          userIds: userId,
          title: "EMERGENCY SOS BROADCASTED",
          message: sosMessage,
          type: "emergency" as const,
          sessionId: targetSessionId,
          metadata: sosMetadata,
        }] : []),
        ...(guardianUserIds.length > 0 ? [{
          userIds: guardianUserIds,
          title: "EMERGENCY SOS FROM GUARDIAN",
          message: sosMessage,
          type: "emergency" as const,
          url: "/main?tab=contacts",
          sessionId: targetSessionId,
          metadata: sosMetadata,
        }] : []),
      ];

      if (alertRequests.length === 0) {
        throw new Error("No signed-in account or selected guardians are available to receive the SOS.");
      }

      const alertResults = await Promise.all(alertRequests.map((request) => dispatchAlert(request)));
      const successfulAlerts = alertResults.filter((result) =>
        !result.error && (result.notificationCount > 0 || result.delivered > 0)
      );
      if (successfulAlerts.length === 0) {
        throw new Error(alertResults.find((result) => result.error)?.error || "No SOS recipients could be reached.");
      }

      localStorage.setItem(sosCountKey, String(usedSos + 1));
      onSosTriggered(targetSessionId, sosCoordinates);
      const locationMessage = sosCoordinates
        ? hasFreshLocation ? "with a fresh GPS fix" : "with your last recent location"
        : "without GPS coordinates; check your device location permission";
      const recipientMessage = guardianUserIds.length === 0 ? " No guardians are selected for this session." : "";
      setActionMessage(`Emergency SOS sent ${locationMessage}.${recipientMessage}${persistenceWarning}`);
      setShowSosModal(false);
    } catch (err) {
      console.error("SOS transmission failed:", err);
      setActionMessage(err instanceof Error ? `${err.message} Please try again.` : "Failed to send Emergency SOS. Please try again.");
    } finally {
      setSosSending(false);
    }
  };

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
          setStagedMedia({
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
          setStagedMedia({
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
    setStagedMedia({
      file,
      previewUrl: URL.createObjectURL(file),
      type: isVideo ? "video" : "image",
    });
  };

  const confirmStagedMedia = () => {
    if (stagedMedia) {
      setAttachedMedia(stagedMedia);
      setStagedMedia(null);
    }
  };

  const removeMedia = () => {
    if (attachedMedia?.previewUrl) {
      URL.revokeObjectURL(attachedMedia.previewUrl);
    }
    setAttachedMedia(null);
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  };

  const handleNextStep = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();

    if (currentStep === 1 && !destination.trim()) {
      setActionMessage("Add a destination to continue.");
      return;
    }

    setActionMessage("");
    if (currentStep < 4) {
      setCurrentStep((s) => s + 1);
    }
  };

  const executeStartSession = async (event: React.FormEvent) => {
    event.preventDefault();
    if (sessionLoading) return;

    if (!destination.trim()) {
      setActionMessage("Add a destination in the first step to start your session.");
      setCurrentStep(1);
      return;
    }

    setActionMessage("");
    let notificationMessage = "";
    try {
      if (userId) {
        const result = await subscribeUserToPush(userId);
        if (!result.ok) notificationMessage = result.reason || "Notifications couldn’t be enabled. You can turn them on later in Settings.";
      }
    } catch (error) {
      console.error("Push permission or subscription failed:", error);
      notificationMessage = "We couldn’t enable notifications right now. You can turn them on later in Settings.";
    }

    const started = await Promise.resolve(handleStartSession(event, locationCoords || undefined));
    if (started === false) {
      setActionMessage("Your session is running on this device, but it couldn’t sync with your contacts. Check your connection before relying on contact alerts.");
    } else if (notificationMessage) {
      setActionMessage(`${notificationMessage} Your session can still continue.`);
    }
  };

  const selectSuggestion = (item: SuggestionItem) => {
    setDestination(item.display_name);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  return (
    <>
      {actionMessage && (
        <div role="alert" className="mx-auto mb-3 flex max-w-md items-start justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <span>{actionMessage}</span>
          <button type="button" onClick={() => setActionMessage("")} className="shrink-0 font-bold underline underline-offset-2">Dismiss</button>
        </div>
      )}

      {stagedMedia && (
        <div className="fixed inset-0 z-99999 bg-black flex flex-col justify-between p-4 max-w-md mx-auto animate-in fade-in">
          <div className="flex items-center justify-between pt-[max(0.75rem,env(safe-area-inset-top))] z-10 px-2">
            <button
              type="button"
              onClick={() => {
                if (stagedMedia.previewUrl) URL.revokeObjectURL(stagedMedia.previewUrl);
                setStagedMedia(null);
              }}
              className="p-3 rounded-full bg-zinc-900/80 text-white backdrop-blur-xl active:scale-90 transition-all border border-zinc-800"
            >
              <X className="w-5 h-5" />
            </button>
            <span className="text-xs font-mono font-bold uppercase text-zinc-300 tracking-widest bg-zinc-900/80 px-4 py-1.5 rounded-full border border-zinc-800">
              Preview Media
            </span>
            <div className="w-11" />
          </div>

          <div className="absolute inset-0 overflow-hidden flex items-center justify-center bg-black p-4">
            {stagedMedia.type === "image" ? (
              <img src={stagedMedia.previewUrl} alt="Preview" className="max-w-full max-h-[80vh] object-contain rounded-2xl" />
            ) : (
              <video src={stagedMedia.previewUrl} controls className="max-w-full max-h-[80vh] object-contain rounded-2xl" />
            )}
          </div>

          <div className="relative z-10 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex items-center justify-center px-4">
            <button
              type="button"
              onClick={confirmStagedMedia}
              className="w-full max-w-sm bg-yellow-400 hover:bg-yellow-300 text-black font-black py-4 rounded-2xl text-xs shadow-xl flex items-center justify-center space-x-2 active:scale-95 transition-all"
            >
              <Check className="w-4 h-4 stroke-3" />
              <span>Confirm & Attach to Session</span>
            </button>
          </div>
        </div>
      )}

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

      {showSosModal && (
        <div className="fixed inset-0 z-99999 bg-black/60 dark:bg-black/70 backdrop-blur-md flex items-center justify-center p-4 transition-colors">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-xs space-y-4 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-black text-black dark:text-white">Trigger Emergency SOS?</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                This sends an urgent alert to the guardians selected for this session. We will request a fresh GPS fix; if unavailable, a location updated within the last two minutes may be included.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSosModal(false)}
                className="py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleTriggerSos()}
                disabled={sosSending}
                className="py-2.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs shadow-lg flex items-center justify-center space-x-1"
              >
                {sosSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Confirm SOS</span>}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeSession ? (
        <div className="pt-2 space-y-6 min-h-[82vh] flex flex-col justify-between max-w-md mx-auto">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <button
                onClick={() => onNavigate("home")}
                className="p-2.5 rounded-full bg-zinc-200/60 dark:bg-zinc-900/60 backdrop-blur-xl text-black dark:text-white active:scale-90 transition-all shadow-sm flex items-center space-x-1.5 pr-4 border border-zinc-300/40 dark:border-zinc-800/50"
              >
                <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                <span className="text-xs font-bold">Home</span>
              </button>

              <button
                type="button"
                onClick={() => setShowSosModal(true)}
                className="px-4 py-2 rounded-full bg-red-600 text-white text-xs font-black flex items-center space-x-1.5 shadow-md shadow-red-600/30 active:scale-95 transition-all animate-pulse"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>SOS</span>
              </button>
            </div>

            <div className="flex items-center space-x-3 px-3 py-3 rounded-2xl bg-zinc-100/80 dark:bg-zinc-900/80 border border-zinc-200/60 dark:border-zinc-800">
              {sharedContacts.length === 0 ? (
                <div className="w-12 h-12 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center shrink-0">
                  <User className="w-6 h-6" />
                </div>
              ) : (
                <div className="relative w-12 h-12 rounded-full overflow-hidden bg-zinc-900 text-yellow-400 border-2 border-black font-black text-xs flex items-center justify-center uppercase shrink-0 shadow-md">
                  {sharedContacts[0].avatar_url ? (
                    <img src={sharedContacts[0].avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    sharedContacts[0].name.slice(0, 2)
                  )}
                  <div className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-black border border-zinc-800 flex items-center justify-center">
                    {sharedContacts[0].isLociUser ? (
                      <Zap className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                    ) : (
                      <MessageSquare className="w-2.5 h-2.5 text-zinc-400" />
                    )}
                  </div>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black text-black dark:text-white truncate">
                  {sharedContacts.length > 0 ? sharedContacts.map(c => c.name).join(", ") : "No recipient selected"}
                </p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                  Guardian Circle: <span className="font-bold text-yellow-500">{sharedContacts[0]?.group_category || "Direct Contact"}</span>
                </p>
              </div>
            </div>

            <div className="rounded-3xl bg-zinc-100/80 dark:bg-zinc-900/80 border border-zinc-300/50 dark:border-zinc-800/80 p-6 backdrop-blur-xl shadow-sm flex items-center justify-center">
              <span className="font-mono font-black text-6xl sm:text-7xl tracking-tighter scale-y-[1.3] text-yellow-500 dark:text-yellow-400 select-none drop-shadow-[0_4px_16px_rgba(250,204,21,0.25)]">
                {formatTime(remainingSeconds)}
              </span>
            </div>

            <div className="flex flex-col items-center text-center space-y-2.5 px-4">
              {isSafetyCheckinDue ? (
                <button
                  type="button"
                  onClick={handleCheckInClick}
                  disabled={isCheckingIn}
                  className="w-full max-w-sm bg-yellow-400 hover:bg-yellow-300 text-black px-5 py-4 rounded-2xl font-black text-base shadow-lg shadow-yellow-400/30 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  {isCheckingIn ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-black" />
                      <span>Confirming...</span>
                    </>
                  ) : (
                    <span>Confirm I’m Safe</span>
                  )}
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
                      <p className="text-[11px] font-extrabold text-black dark:text-white">Live Location / Pinned Address</p>
                      <p className="text-[10px] text-zinc-600 dark:text-zinc-300 font-semibold truncate">
                        {locationAddress
                          ? locationAddress
                          : locationCoords
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
                    Updated {locationUpdatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} (Auto-refreshes every 5m)
                  </p>
                )}
              </div>

              {locationCoords && (
                <div className="relative group">
                  <div onClick={() => setIsMapFullScreen(true)} className="cursor-pointer">
                    <SatelliteMap
                      latitude={locationCoords.latitude}
                      longitude={locationCoords.longitude}
                      nickname="You"
                      avatarUrl={userAvatarUrl}
                      interactive={false}
                      manuallyPicked={manuallyPickedLocation}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMapFullScreen(true)}
                    className="absolute top-2 right-2 p-2 rounded-xl bg-black/70 backdrop-blur-md text-white border border-zinc-700 active:scale-90 transition-all flex items-center space-x-1 text-[10px] font-bold"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Expand</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {isMapFullScreen && locationCoords && (
            <div className="fixed inset-0 z-99999 bg-white/95 dark:bg-black/90 backdrop-blur-md flex items-center justify-center p-3 transition-colors">
              <div className="w-full max-w-md h-[90vh] bg-zinc-100 dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between overflow-hidden p-3 shadow-2xl">
                <div className="flex items-center justify-between pb-2">
                  <span className="text-xs font-black text-black dark:text-white">Live Mobile Map</span>
                  <button
                    type="button"
                    onClick={() => setIsMapFullScreen(false)}
                    className="p-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-black dark:text-white text-xs font-bold flex items-center space-x-1 px-3 active:scale-95 transition-all"
                  >
                    <Minimize2 className="w-3.5 h-3.5" />
                    <span>Close</span>
                  </button>
                </div>
                <div className="flex-1 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
                  <SatelliteMap
                    latitude={locationCoords.latitude}
                    longitude={locationCoords.longitude}
                    nickname="You"
                    avatarUrl={userAvatarUrl}
                    interactive
                    manuallyPicked={manuallyPickedLocation}
                    onLocationChange={handleLocationPicked}
                    className="h-full w-full"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="pb-6">
            <button
              type="button"
              onClick={onEndSessionClick}
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
        <div className="pt-[max(0.5rem,env(safe-area-inset-top))] space-y-4 max-w-md mx-auto min-h-[82vh] flex flex-col justify-between">
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleGallerySelect}
            className="hidden"
          />

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

          <div className="flex-1 flex flex-col justify-between">
            <div className="overflow-hidden relative flex-1 py-2">
              <div
                className="flex transition-transform duration-300 ease-out h-full"
                style={{ transform: `translateX(-${(currentStep - 1) * 100}%)` }}
              >
                <div className="w-full shrink-0 space-y-5 px-1">
                  <div className="space-y-1">
                    <h2 className="text-lg font-black text-black dark:text-white flex items-center gap-2">
                      <span>Where are you heading?</span>
                      <MapPin className="w-5 h-5 text-yellow-400" />
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Specify your destination address in your detected country and set departure GPS.
                    </p>
                  </div>

                  <div className="space-y-2 relative">
                    <label className="block text-xs font-extrabold text-black dark:text-white">
                      Destination Address / Route
                    </label>
                    <div className="relative flex items-center">
                      <MapPin className="w-4 h-4 absolute left-4 text-zinc-400 z-10" />
                      <input
                        type="text"
                        placeholder="e.g. Street or Landmark"
                        value={destination}
                        onChange={(e) => {
                          setDestination(e.target.value);
                          setShowSuggestions(true);
                        }}
                        onFocus={() => setShowSuggestions(true)}
                        className="w-full bg-zinc-200/60 dark:bg-zinc-900/80 border border-zinc-300/50 dark:border-zinc-800 rounded-2xl pl-11 pr-10 py-4 text-xs font-semibold text-black dark:text-white focus:outline-none focus:border-yellow-400 transition-all shadow-inner"
                      />
                      {isFetchingSuggestions && (
                        <Loader2 className="w-4 h-4 absolute right-4 text-yellow-500 animate-spin z-10" />
                      )}
                    </div>

                    {showSuggestions && suggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-300/60 dark:border-zinc-800 rounded-2xl shadow-2xl max-h-52 overflow-y-auto divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
                        {suggestions.map((item) => (
                          <button
                            key={item.place_id}
                            type="button"
                            onClick={() => selectSuggestion(item)}
                            className="w-full text-left px-4 py-3 text-xs font-semibold text-black dark:text-zinc-200 hover:bg-yellow-400/20 transition-colors flex items-start gap-2"
                          >
                            <MapPin className="w-3.5 h-3.5 text-yellow-500 shrink-0 mt-0.5" />
                            <span className="line-clamp-2 leading-tight">{item.display_name}</span>
                          </button>
                        ))}
                      </div>
                    )}
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
                        nickname="You"
                        avatarUrl={userAvatarUrl}
                        interactive
                        manuallyPicked={manuallyPickedLocation}
                        onLocationChange={handleLocationPicked}
                      />
                    )}
                  </div>
                </div>

                <div className="w-full shrink-0 space-y-5 px-1">
                  <div className="space-y-1">
                    <h2 className="text-lg font-black text-black dark:text-white flex items-center gap-2">
                      <span>When are you returning?</span>
                      <Clock className="w-5 h-5 text-yellow-400" />
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Pick your return day and target arrival time {tier === "free" ? "(Max 1 day for Free users)" : "(Unlimited for Plus)"}.
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
                          onClick={() => {
                            if (tier === "free" && opt.offset > 0) {
                              setActionMessage("Free users are limited to 1-day sessions. Upgrade to Plus for multi-day sessions!");
                              return;
                            }
                            setSelectedDayOffset(opt.offset);
                          }}
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
                        value={userReminderMins}
                        onChange={(event) => setUserReminderMins(event.target.value ? Number(event.target.value) : "")}
                        className="w-full bg-zinc-200/60 dark:bg-zinc-900/80 border border-zinc-300/50 dark:border-zinc-800 rounded-2xl px-4 py-3.5 text-xs font-semibold text-black dark:text-white focus:outline-none focus:border-yellow-400"
                      />
                      <p className="text-[10px] text-zinc-500">How often your phone asks &quot;Confirm I&apos;m safe&quot;.</p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-extrabold text-black dark:text-white">
                        Guardian Escalation Grace Period (Minutes)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="1440"
                        value={contactReminderMins}
                        onChange={(event) => setContactReminderMins(event.target.value ? Number(event.target.value) : "")}
                        className="w-full bg-zinc-200/60 dark:bg-zinc-900/80 border border-zinc-300/50 dark:border-zinc-800 rounded-2xl px-4 py-3.5 text-xs font-semibold text-black dark:text-white focus:outline-none focus:border-yellow-400"
                      />
                      <p className="text-[10px] text-zinc-500">Grace period after missed return time before guardians are alerted.</p>
                    </div>
                  </div>
                </div>

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

                  {tier === "free" && (
                    <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-2xl p-3 flex items-center justify-between gap-2">
                      <div className="flex items-center space-x-2 min-w-0">
                        <Zap className="w-4 h-4 text-yellow-500 fill-yellow-500 shrink-0" />
                        <span className="text-[11px] font-bold text-black dark:text-white truncate">
                          Free plan: Up to 3 contacts
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onNavigate("profile")}
                        className="text-[10px] font-black bg-yellow-400 text-black px-2.5 py-1 rounded-full shrink-0 active:scale-95 transition-all"
                      >
                        Upgrade Pro
                      </button>
                    </div>
                  )}

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

                  <div className="space-y-2.5">
                    <label className="block text-xs font-extrabold text-black dark:text-white">
                      Selfie / Proof & Notes (Optional)
                    </label>

                    {attachedMedia ? (
                      <div className="relative rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-700/60 h-36 flex items-center justify-center shadow-lg">
                        {attachedMedia.type === "image" ? (
                          <img src={attachedMedia.previewUrl} alt="Selfie preview" className="w-full h-full object-cover" />
                        ) : (
                          <div className="relative w-full h-full bg-black flex items-center justify-center">
                            <video src={attachedMedia.previewUrl} className="w-full h-full object-cover" />
                            <Play className="w-8 h-8 text-white absolute fill-white opacity-80" />
                          </div>
                        )}
                        <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] text-white font-medium">
                          Attached ✓
                        </div>
                        <button
                          type="button"
                          onClick={removeMedia}
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/80 text-white backdrop-blur-md hover:bg-red-600 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={startCamera}
                          className="flex items-center justify-center space-x-2 py-3 px-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 text-xs font-bold text-black dark:text-white hover:border-yellow-400 transition-all"
                        >
                          <Camera className="w-4 h-4 text-zinc-400" />
                          <span>Take Selfie</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => galleryInputRef.current?.click()}
                          className="flex items-center justify-center space-x-2 py-3 px-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 text-xs font-bold text-black dark:text-white hover:border-yellow-400 transition-all"
                        >
                          <Paperclip className="w-4 h-4 text-zinc-400" />
                          <span>Upload File</span>
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
                  onClick={handleNextStep}
                  className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-black font-extrabold py-4 rounded-full text-xs transition-all flex items-center justify-center space-x-2 active:scale-95 shadow-lg shadow-yellow-400/20"
                >
                  <span>Next Step</span>
                  <ArrowRight className="w-4 h-4 stroke-3" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => void executeStartSession(e)}
                  disabled={sessionLoading}
                  className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-black font-extrabold py-4 rounded-full text-xs transition-all flex items-center justify-center space-x-2 active:scale-95 disabled:opacity-40 shadow-lg shadow-yellow-400/20"
                >
                  {sessionLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-black" />
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-black fill-black" />
                      <span>Start Session</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}