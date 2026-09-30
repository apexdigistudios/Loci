"use client";

import React, { useState, useRef } from "react";
import {
  ChevronLeft,
  Sparkles,
  Clock,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  MapPin,
  Check,
  Camera,
  Paperclip,
  X,
  Play,
} from "lucide-react";

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
  onNavigate: (tab: "home" | "session" | "contacts" | "profile") => void;
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Direct WebRTC Front Camera Stream (Fixes desktop & browser fallback issues)
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
      // Fallback to native capture input if WebRTC stream fails
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

  return (
    <div className="pt-[max(0.5rem,env(safe-area-inset-top))] space-y-6">
      {/* Hidden Gallery Input */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleGallerySelect}
        className="hidden"
      />

      {/* Top Body Header */}
      <div className="relative flex items-center justify-center pt-2 pb-4">
        <button
          onClick={() => onNavigate("home")}
          className="absolute left-0 p-2.5 rounded-full bg-zinc-200/70 dark:bg-zinc-800/80 backdrop-blur-xl text-black dark:text-white active:scale-90 transition-all shadow-sm"
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

      {activeSession ? (
        /* Active Live Session View */
        <div className="bg-yellow-400 text-black rounded-[28px] p-6 shadow-xl space-y-6 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center space-x-1 text-[10px] font-black uppercase tracking-widest bg-black text-yellow-400 px-3 py-1 rounded-full">
              <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
              <span>LIVE WATCH ACTIVE</span>
            </span>
            <Clock className="w-5 h-5 text-black" />
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase text-black/60 tracking-wider">
              Destination
            </p>
            <h3 className="text-2xl font-black leading-tight text-black">
              {activeSession.destination}
            </h3>
          </div>

          <div className="bg-black/10 backdrop-blur-md p-4 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase text-black/70">
                Estimated Arrival
              </p>
              <p className="text-lg font-black font-mono text-black">
                {new Date(activeSession.expected_arrival_at).toLocaleTimeString(
                  [],
                  {
                    hour: "2-digit",
                    minute: "2-digit",
                  }
                )}
              </p>
            </div>
            <ShieldAlert className="w-8 h-8 text-black/80" />
          </div>

          <button
            onClick={handleCompleteSession}
            disabled={sessionLoading}
            className="w-full bg-black hover:bg-zinc-900 text-white font-black py-4 rounded-2xl text-xs transition-all flex items-center justify-center space-x-2 active:scale-95 shadow-xl"
          >
            {sessionLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-yellow-400" />
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5 text-yellow-400" />
                <span>I HAVE ARRIVED SAFELY 🎉</span>
              </>
            )}
          </button>
        </div>
      ) : (
        /* Clean iOS Form View */
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
                className="w-full bg-zinc-200/60 dark:bg-zinc-900/80 border border-zinc-300/50 dark:border-zinc-800 rounded-full pl-11 pr-5 py-3.5 text-xs font-semibold text-black dark:text-white focus:outline-none focus:border-yellow-400 dark:focus:border-yellow-400 transition-all shadow-inner"
              />
            </div>
          </div>

          {/* Question 2: Flexible Duration */}
          <div className="space-y-2.5">
            <label className="block text-sm font-extrabold text-black dark:text-white px-1">
              How long will your trip take? ⏱️️
            </label>

            <div className="grid grid-cols-4 gap-2">
              {[15, 30, 45, 60].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setDurationMinutes(mins)}
                  className={`py-2.5 rounded-full text-xs font-black transition-all border ${
                    durationMinutes === mins
                      ? "bg-yellow-400 text-black border-yellow-400 shadow-sm scale-105"
                      : "bg-zinc-200/60 dark:bg-zinc-900/80 text-zinc-600 dark:text-zinc-400 border-zinc-300/50 dark:border-zinc-800"
                  }`}
                >
                  {mins}m
                </button>
              ))}
            </div>

            <div className="relative flex items-center">
              <Clock className="w-4 h-4 absolute left-4 text-zinc-400" />
              <input
                type="number"
                min="1"
                max="300"
                required
                placeholder="Or enter flexible duration (e.g. 25 minutes)"
                value={durationMinutes}
                onChange={(e) =>
                  setDurationMinutes(
                    e.target.value ? Number(e.target.value) : ""
                  )
                }
                className="w-full bg-zinc-200/60 dark:bg-zinc-900/80 border border-zinc-300/50 dark:border-zinc-800 rounded-full pl-11 pr-5 py-3.5 text-xs font-semibold text-black dark:text-white focus:outline-none focus:border-yellow-400 dark:focus:border-yellow-400 transition-all shadow-inner"
              />
            </div>
          </div>

          {/* Question 3: Share Live Location With Guardians */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <label className="block text-sm font-extrabold text-black dark:text-white">
                Share live location with 🛡️
              </label>
              <span className="text-[10px] font-bold text-zinc-400">
                {selectedContactIds.length} Selected
              </span>
            </div>

            {contacts.length === 0 ? (
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center justify-between">
                <span>⚠️ No contacts added yet.</span>
                <button
                  type="button"
                  onClick={() => onNavigate("contacts")}
                  className="underline font-black"
                >
                  Add Guardians
                </button>
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
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Question 4: Selfie or Media Capture */}
          <div className="space-y-3">
            <label className="block text-sm font-extrabold text-black dark:text-white px-1">
              Selfie or Media Proof (Optional) 📸
            </label>

            {isCameraActive ? (
              /* Live Camera Stream View */
              <div className="relative rounded-3xl overflow-hidden bg-black h-60 flex flex-col items-center justify-center border border-zinc-800 shadow-xl">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover -scale-x-100"
                />
                <div className="absolute bottom-3 flex items-center space-x-4">
                  <button
                    type="button"
                    onClick={captureSelfie}
                    className="bg-yellow-400 text-black p-3.5 rounded-full font-black text-xs flex items-center space-x-1.5 active:scale-90 transition-all shadow-lg"
                  >
                    <Camera className="w-5 h-5" />
                    <span>Snap Selfie</span>
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="bg-black/60 backdrop-blur-md text-white p-3 rounded-full active:scale-90 transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ) : attachedMedia ? (
              /* Media Preview Box */
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
                    <Play className="w-8 h-8 text-yellow-400 absolute fill-yellow-400 opacity-80" />
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
              /* Capture Mode Selection */
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={startCamera}
                  className="flex items-center justify-center space-x-2 py-3.5 px-4 rounded-full bg-zinc-200/60 dark:bg-zinc-900/80 border border-zinc-300/50 dark:border-zinc-800 text-xs font-extrabold text-black dark:text-white hover:border-yellow-400 active:scale-95 transition-all"
                >
                  <Camera className="w-4 h-4 text-yellow-500" />
                  <span>Take Selfie 🤳</span>
                </button>

                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex items-center justify-center space-x-2 py-3.5 px-4 rounded-full bg-zinc-200/60 dark:bg-zinc-900/80 border border-zinc-300/50 dark:border-zinc-800 text-xs font-extrabold text-black dark:text-white hover:border-yellow-400 active:scale-95 transition-all"
                >
                  <Paperclip className="w-4 h-4 text-yellow-500" />
                  <span>Upload Media 📁</span>
                </button>
              </div>
            )}

            <input
              type="text"
              placeholder="Add extra details (e.g. Uber, Hyundai Accent)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-zinc-200/60 dark:bg-zinc-900/80 border border-zinc-300/50 dark:border-zinc-800 rounded-full px-5 py-3.5 text-xs font-semibold text-black dark:text-white focus:outline-none focus:border-yellow-400 dark:focus:border-yellow-400 transition-all shadow-inner"
            />
          </div>

          {/* Start Action Pill */}
          <button
            type="submit"
            disabled={
              sessionLoading ||
              contacts.length === 0 ||
              selectedContactIds.length === 0
            }
            className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-black py-4 rounded-full text-xs transition-all flex items-center justify-center space-x-1.5 active:scale-[0.97] disabled:opacity-40 shadow-lg shadow-yellow-400/20 mt-4"
          >
            {sessionLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-black" />
            ) : (
              <span>Start</span>
            )}
          </button>
        </form>
      )}
    </div>
  );
}