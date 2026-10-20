"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  User,
  Settings,
  Bell,
  MapPin,
  CheckCircle,
  AlertCircle,
  LogOut,
  ShieldCheck,
  ChevronRight,
  Camera,
  Sun,
  Moon,
  Monitor,
  Loader2,
  Zap,
  Check,
  ArrowLeft,
  Sparkles,
  Shield,
} from "lucide-react";
import { useTheme } from "next-themes";
import { supabase } from "@/lib/supabase";
import { useSubscription } from "@/hooks/use-subscription";

interface ProfilePageProps {
  fullName: string;
  nickname: string;
  userId: string | null;
  userPhone: string;
  avatarUrl?: string;
  onAvatarChange?: (url: string) => void;
  notificationPermission: NotificationPermission;
  locationStatus: "idle" | "requesting" | "granted" | "low-accuracy" | "denied";
  locationCoords: { lat: number; lng: number } | null;
  triggerNotificationPrompt: () => void;
  triggerLocationPrompt: () => void;
  onTestPush: () => Promise<string>;
  onLogout: () => void;
}

const UPGRADE_BENEFITS = [
  { title: "Unlimited Trusted Contacts", desc: "Add as many guardians & family members as you need." },
  { title: "Custom Circle Groups", desc: "Organize into Emergency, Family, and Besties circles." },
  { title: "Priority Safety Escalation", desc: "Instant automated alerts dispatched to your circle." },
];

const PLUS_ADS = [
  { tag: "🛡️ TOTAL PROTECTION", title: "Never Walk Alone", desc: "Keep your entire circle linked to your journey in real time." },
  { tag: "⚡ LIGHTNING FAST", title: "Instant SOS Dispatch", desc: "Automatic grace-period escalation if check-ins are missed." },
];

export function ProfilePage({
  fullName,
  nickname,
  userId,
  userPhone,
  avatarUrl,
  onAvatarChange,
  notificationPermission,
  locationStatus,
  triggerNotificationPrompt,
  triggerLocationPrompt,
  onTestPush,
  onLogout,
}: ProfilePageProps) {
  const [subView, setSubView] = useState<"profile" | "settings" | "upgrade">("profile");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [currentAvatar, setCurrentAvatar] = useState<string | undefined>(avatarUrl);
  const [testPushBusy, setTestPushBusy] = useState(false);
  const [testPushResult, setTestPushResult] = useState("");
  const [activeAdIndex, setActiveAdIndex] = useState(0);
  const [checkoutLoading, setCheckoutLoading] = useState<"monthly" | "yearly" | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { theme, setTheme } = useTheme();
  const { tier } = useSubscription(userId || undefined);

  useEffect(() => {
    if (subView !== "upgrade") return;
    const interval = setInterval(() => {
      setActiveAdIndex((prev) => (prev + 1) % PLUS_ADS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [subView]);

  const compressImage = (file: File, maxSize = 250): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxSize) {
              height = Math.round((height * maxSize) / width);
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = Math.round((width * maxSize) / height);
              height = maxSize;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Could not get canvas context"));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else reject(new Error("Image compression failed"));
            },
            "image/jpeg",
            0.75
          );
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = event.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);

    try {
      const compressedBlob = await compressImage(file);
      const localPreviewUrl = URL.createObjectURL(compressedBlob);
      setCurrentAvatar(localPreviewUrl);

      const sanitizedPhone = userPhone.replace(/[^a-zA-Z0-9]/g, "");
      const filePath = `${sanitizedPhone}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, compressedBlob, {
          upsert: true,
          contentType: "image/jpeg",
          cacheControl: "3600",
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const publicUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

      if (!userId) throw new Error("Your profile is still loading. Please try again.");
      const { error: profileError } = await supabase
        .from("users")
        .update({ avatar_url: publicUrl })
        .eq("id", userId);
      if (profileError) throw profileError;

      setCurrentAvatar(publicUrl);
      if (onAvatarChange) onAvatarChange(publicUrl);
    } catch (err) {
      console.error("Avatar upload error:", err);
      setCurrentAvatar(avatarUrl);
      alert("Failed to upload image. Please ensure your connection is active and try again.");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const openPaddleCheckout = (interval: "monthly" | "yearly") => {
    const priceId = interval === "monthly" 
      ? process.env.NEXT_PUBLIC_PADDLE_PLUS_MONTHLY_PRICE_ID 
      : process.env.NEXT_PUBLIC_PADDLE_PLUS_YEARLY_PRICE_ID;

    if (!priceId) {
      alert(`Missing ${interval} price ID in environment variables.`);
      return;
    }

    setCheckoutLoading(interval);

    const Paddle = (window as unknown as { Paddle?: { Checkout: { open: (arg: unknown) => void } } }).Paddle;

    if (!Paddle) {
      setCheckoutLoading(null);
      alert("Paddle SDK is still loading. Please check your connection.");
      return;
    }

    Paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customer: { email: `${userPhone.replace(/[^a-zA-Z0-9]/g, "")}@deloci.app` },
      customData: { user_id: userId },
      settings: {
        displayMode: "overlay",
        successUrl: `${window.location.origin}/main?tab=profile&success=true`,
      },
    });

    setCheckoutLoading(null);
  };

  return (
    <div className="space-y-5">
      <input
        type="file"
        ref={fileInputRef}
        accept="image/jpeg,image/png,image/webp,image/heic"
        onChange={handleFileChange}
        className="hidden"
      />

      {subView !== "upgrade" && (
        <div className="p-1 bg-zinc-200/60 dark:bg-zinc-900/80 rounded-full grid grid-cols-2 gap-1 border border-zinc-300/40 dark:border-zinc-800">
          <button
            onClick={() => setSubView("profile")}
            className={`py-2 rounded-full text-xs font-black transition-all flex items-center justify-center space-x-1.5 ${
              subView === "profile"
                ? "bg-white dark:bg-zinc-800 text-black dark:text-white shadow-sm"
                : "text-zinc-400 hover:text-black dark:hover:text-white"
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Profile</span>
          </button>

          <button
            onClick={() => setSubView("settings")}
            className={`py-2 rounded-full text-xs font-black transition-all flex items-center justify-center space-x-1.5 ${
              subView === "settings"
                ? "bg-white dark:bg-zinc-800 text-black dark:text-white shadow-sm"
                : "text-zinc-400 hover:text-black dark:hover:text-white"
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>
        </div>
      )}

      {/* UPGRADE PAGEVIEW */}
      {subView === "upgrade" ? (
        <div className="space-y-5 animate-in fade-in slide-in-from-right-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setSubView("profile")}
              className="p-2.5 rounded-full bg-zinc-200/60 dark:bg-zinc-900/80 text-black dark:text-white flex items-center space-x-1.5 pr-4 border border-zinc-300/40 dark:border-zinc-800 active:scale-95 transition-all"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
              <span className="text-xs font-bold">Back</span>
            </button>
            <span className="text-xs font-mono font-bold uppercase text-yellow-500 tracking-wider">Déloci Plus Upgrade</span>
            <div className="w-10" />
          </div>

          {/* Hero Section */}
          <div className="bg-zinc-900 text-white rounded-4xl p-6 border border-yellow-400/30 text-center relative overflow-hidden space-y-4 shadow-xl">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Shield className="w-32 h-32 text-yellow-400" />
            </div>
            <div className="absolute inset-0 bg-linear-to-t from-black via-transparent to-transparent pointer-events-none" />

            <div className="relative z-10 w-14 h-14 rounded-2xl bg-yellow-400 text-black flex items-center justify-center mx-auto shadow-lg shadow-yellow-400/30">
              <Sparkles className="w-7 h-7 fill-black" />
            </div>

            <div className="relative z-10 space-y-1">
              <h2 className="text-xl font-black text-white">Unlock Full Safety Control</h2>
              <p className="text-xs text-zinc-300 max-w-xs mx-auto">
                Get unlimited trusted contacts, circle groups, and priority emergency dispatch.
              </p>
            </div>

            {/* Ads Carousel */}
            <div className="relative z-10 bg-white/10 dark:bg-zinc-800/80 backdrop-blur-md rounded-2xl p-4 border border-white/10 text-left">
              <span className="text-[9px] font-black uppercase text-yellow-400 tracking-widest block mb-1">
                {PLUS_ADS[activeAdIndex].tag}
              </span>
              <h4 className="text-xs font-extrabold text-white">{PLUS_ADS[activeAdIndex].title}</h4>
              <p className="text-[11px] text-zinc-300">{PLUS_ADS[activeAdIndex].desc}</p>
              
              <div className="flex justify-center gap-1.5 pt-3">
                {PLUS_ADS.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-1 rounded-full transition-all duration-300 ${
                      idx === activeAdIndex ? "w-6 bg-yellow-400" : "w-1.5 bg-zinc-600"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Benefits list */}
          <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border border-zinc-200/50 dark:border-zinc-800/50 rounded-[28px] p-5 space-y-3.5 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">Plus Features Included</h3>
            <div className="space-y-3">
              {UPGRADE_BENEFITS.map((b, idx) => (
                <div key={idx} className="flex items-start space-x-3">
                  <div className="w-5 h-5 rounded-full bg-yellow-400/20 text-yellow-500 flex items-center justify-center shrink-0 mt-0.5 border border-yellow-400/40">
                    <Check className="w-3 h-3 stroke-3" />
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-black dark:text-white">{b.title}</h4>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing Options */}
          <div className="grid grid-cols-1 gap-3">
            <button
              type="button"
              onClick={() => openPaddleCheckout("monthly")}
              disabled={checkoutLoading !== null}
              className="w-full bg-yellow-400 hover:bg-yellow-300 text-black p-4 rounded-2xl flex items-center justify-between active:scale-[0.98] transition-all shadow-lg shadow-yellow-400/20 disabled:opacity-50"
            >
              <div className="text-left">
                <span className="text-[10px] font-black uppercase bg-black text-yellow-400 px-2 py-0.5 rounded-full">Monthly Plan</span>
                <p className="text-base font-black mt-1">$2.99 <span className="text-xs font-bold text-zinc-800">/ month</span></p>
              </div>
              <div className="flex items-center space-x-1 font-extrabold text-xs bg-black text-yellow-400 px-4 py-2.5 rounded-xl">
                {checkoutLoading === "monthly" ? <Loader2 className="w-4 h-4 animate-spin text-yellow-400" /> : <span>Subscribe Now</span>}
              </div>
            </button>

            <button
              type="button"
              onClick={() => openPaddleCheckout("yearly")}
              disabled={checkoutLoading !== null}
              className="w-full bg-zinc-900 dark:bg-white text-white dark:text-black p-4 rounded-2xl flex items-center justify-between active:scale-[0.98] transition-all shadow-lg disabled:opacity-50 border border-yellow-400/40 relative overflow-hidden"
            >
              <div className="absolute top-2 right-2 bg-yellow-400 text-black text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                16% Discount
              </div>
              <div className="text-left">
                <span className="text-[10px] font-black uppercase bg-yellow-400 text-black px-2 py-0.5 rounded-full">Yearly Plan</span>
                <p className="text-base font-black mt-1">$29.99 <span className="text-xs font-bold text-zinc-400 dark:text-zinc-600">/ year</span></p>
              </div>
              <div className="flex items-center space-x-1 font-extrabold text-xs bg-yellow-400 text-black px-4 py-2.5 rounded-xl">
                {checkoutLoading === "yearly" ? <Loader2 className="w-4 h-4 animate-spin text-black" /> : <span>Subscribe Yearly</span>}
              </div>
            </button>
          </div>
        </div>
      ) : subView === "profile" ? (
        <div className="space-y-4">
          <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border border-zinc-200/50 dark:border-zinc-800/50 rounded-[28px] p-6 text-center space-y-3 shadow-sm relative overflow-hidden">
            <div className="relative w-22 h-22 mx-auto group">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="w-full h-full rounded-full overflow-hidden bg-zinc-900 text-yellow-400 border-2 border-yellow-400 font-black text-2xl flex items-center justify-center uppercase shadow-md relative active:scale-95 transition-all"
                title="Change Profile Image"
              >
                {currentAvatar ? (
                  <img
                    src={currentAvatar}
                    alt={nickname || "Profile Avatar"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{nickname ? nickname.slice(0, 2) : "ME"}</span>
                )}

                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-white text-[10px] font-extrabold">
                  {uploadingAvatar ? (
                    <Loader2 className="w-5 h-5 animate-spin text-yellow-400" />
                  ) : (
                    <>
                      <Camera className="w-5 h-5 text-yellow-400 mb-0.5" />
                      <span>Change</span>
                    </>
                  )}
                </div>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute bottom-0 right-0 p-2 rounded-full bg-yellow-400 text-black shadow-md border-2 border-white dark:border-black active:scale-90 transition-all disabled:opacity-50"
                title="Upload Photo"
              >
                {uploadingAvatar ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                ) : (
                  <Camera className="w-3.5 h-3.5 stroke-[2.5]" />
                )}
              </button>
            </div>

            <div>
              <div className="flex items-center justify-center gap-1.5">
                <h2 className="text-lg font-black text-black dark:text-white leading-tight">
                  {fullName || nickname || "Déloci User"}
                </h2>
                {tier === "plus" && (
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-500 text-white shadow-xs" title="Meta Verified Plus Member">
                    <Check className="w-2.5 h-2.5 stroke-3" />
                  </span>
                )}
              </div>
              <p className="text-xs font-mono font-semibold text-zinc-400 mt-0.5">
                {userPhone}
              </p>
            </div>

            <div className="pt-2 flex justify-center items-center gap-2">
              <span className="inline-flex items-center space-x-1 text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full border border-emerald-500/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Protected Member</span>
              </span>

              {tier === "plus" ? (
                <span className="inline-flex items-center space-x-1 text-[10px] font-black uppercase tracking-wider bg-yellow-400/20 text-yellow-500 border border-yellow-400/30 px-3 py-1 rounded-full">
                  <Zap className="w-3 h-3 fill-current" />
                  <span>PLUS TIER</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 text-[10px] font-black uppercase tracking-wider bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700 px-3 py-1 rounded-full">
                  <span>FREE TIER (3 Contacts Max)</span>
                </span>
              )}
            </div>
          </div>

          <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border border-zinc-200/50 dark:border-zinc-800/50 rounded-[26px] p-4 space-y-3 text-xs shadow-sm">
            <div className="flex justify-between items-center pb-2.5 border-b border-zinc-100 dark:border-zinc-800/80">
              <span className="text-zinc-400 font-medium">Full Name</span>
              <span className="font-extrabold text-black dark:text-white">{fullName || "—"}</span>
            </div>
            <div className="flex justify-between items-center pb-2.5 border-b border-zinc-100 dark:border-zinc-800/80">
              <span className="text-zinc-400 font-medium">Nickname</span>
              <span className="font-extrabold text-black dark:text-white">{nickname || "—"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-400 font-medium">Phone Number</span>
              <span className="font-mono font-extrabold text-black dark:text-white">{userPhone}</span>
            </div>
          </div>

          {/* WhatsApp Style Upgrade Banner */}
          {tier === "free" && userId && (
            <button
              type="button"
              onClick={() => setSubView("upgrade")}
              className="w-full bg-linear-to-r from-yellow-400 to-amber-400 hover:from-yellow-300 hover:to-amber-300 text-black p-4 rounded-[26px] flex items-center justify-between active:scale-[0.98] transition-all shadow-lg shadow-yellow-400/20 group"
            >
              <div className="flex items-center space-x-3 text-left">
                <div className="w-10 h-10 rounded-2xl bg-black text-yellow-400 flex items-center justify-center shrink-0 shadow-md">
                  <Zap className="w-5 h-5 fill-yellow-400" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-black">Upgrade to Déloci Plus</h3>
                  <p className="text-[11px] font-bold text-zinc-900/80">Unlock unlimited contacts & advanced alerts</p>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-black/10 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                <ChevronRight className="w-4 h-4 text-black stroke-3" />
              </div>
            </button>
          )}

          <button
            onClick={() => setSubView("settings")}
            className="w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-4 flex items-center justify-between text-xs font-extrabold text-black dark:text-white active:scale-[0.98] transition-all shadow-sm"
          >
            <div className="flex items-center space-x-2.5">
              <Settings className="w-4 h-4 text-zinc-400" />
              <span>App Permissions & System Settings</span>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-400" />
          </button>

          <button
            onClick={onLogout}
            className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 font-extrabold py-3.5 rounded-2xl text-xs flex items-center justify-center space-x-2 active:scale-95 transition-all border border-red-500/20"
          >
            <LogOut className="w-4 h-4" />
            <span>Log Out of Déloci</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-black text-black dark:text-white">App Preferences & Security ⚙️</h3>
            <p className="text-[11px] text-zinc-400">Configure theme appearance and device permissions.</p>
          </div>

          <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border border-zinc-200/50 dark:border-zinc-800/50 rounded-[26px] p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-xs font-black text-black dark:text-white">Appearance Theme</p>
                <p className="text-[11px] text-zinc-400">Customize dark or light app styling</p>
              </div>
              <span className="text-[10px] font-mono uppercase font-black bg-yellow-400 text-black px-2 py-0.5 rounded-full">
                {theme || "system"}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                onClick={() => setTheme("light")}
                className={`py-2.5 px-3 rounded-2xl text-xs font-extrabold transition-all border flex items-center justify-center space-x-1.5 ${
                  theme === "light"
                    ? "bg-yellow-400 text-black border-yellow-400 shadow-sm"
                    : "bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700/60"
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Light</span>
              </button>

              <button
                onClick={() => setTheme("dark")}
                className={`py-2.5 px-3 rounded-2xl text-xs font-extrabold transition-all border flex items-center justify-center space-x-1.5 ${
                  theme === "dark"
                    ? "bg-yellow-400 text-black border-yellow-400 shadow-sm"
                    : "bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700/60"
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Dark</span>
              </button>

              <button
                onClick={() => setTheme("system")}
                className={`py-2.5 px-3 rounded-2xl text-xs font-extrabold transition-all border flex items-center justify-center space-x-1.5 ${
                  theme === "system"
                    ? "bg-yellow-400 text-black border-yellow-400 shadow-sm"
                    : "bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700/60"
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Auto</span>
              </button>
            </div>
          </div>

          <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border border-zinc-200/50 dark:border-zinc-800/50 rounded-[26px] p-4 flex items-center justify-between shadow-sm">
            <div className="space-y-0.5">
              <div className="flex items-center space-x-1.5">
                <Bell className="w-4 h-4 text-yellow-500" />
                <p className="text-xs font-black text-black dark:text-white">Push Notifications</p>
              </div>
              <p className="text-[11px] text-zinc-400">Alerts for safety timer escalation</p>
            </div>

            {notificationPermission === "granted" ? (
              <span className="inline-flex items-center space-x-1 text-[10px] font-black bg-emerald-500/10 text-emerald-500 px-2.5 py-1 rounded-full">
                <CheckCircle className="w-3 h-3" />
                <span>On</span>
              </span>
            ) : notificationPermission === "denied" ? (
              <div className="text-right">
                <span className="inline-flex items-center space-x-1 text-[10px] font-black bg-red-500/10 text-red-500 px-2.5 py-1 rounded-full mb-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>Off</span>
                </span>
                <p className="max-w-36 text-[10px] leading-snug text-zinc-500">Turn notifications on in your browser or device settings to receive safety updates.</p>
              </div>
            ) : (
              <button
                onClick={triggerNotificationPrompt}
                className="bg-yellow-400 text-black font-black px-3 py-1.5 rounded-full text-xs active:scale-95 transition-all shadow-sm"
              >
                Allow 🔔
              </button>
            )}
          </div>

          {process.env.NODE_ENV === "development" && (
            <div className="space-y-2 rounded-2xl border border-zinc-200/60 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 p-4">
              <button
                type="button"
                disabled={testPushBusy || !userId}
                onClick={async () => {
                  setTestPushBusy(true);
                  setTestPushResult("");
                  try {
                    setTestPushResult(await onTestPush());
                  } finally {
                    setTestPushBusy(false);
                  }
                }}
                className="w-full rounded-xl bg-yellow-400 py-3 text-xs font-black text-black disabled:opacity-50"
              >
                {testPushBusy ? "Sending test notification..." : "Send Test Notification"}
              </button>
              {testPushResult && <p role="status" className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">{testPushResult}</p>}
            </div>
          )}

          <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border border-zinc-200/50 dark:border-zinc-800/50 rounded-[26px] p-4 flex items-center justify-between shadow-sm">
            <div className="space-y-0.5">
              <div className="flex items-center space-x-1.5">
                <MapPin className="w-4 h-4 text-yellow-500" />
                <p className="text-xs font-black text-black dark:text-white">Location Services</p>
              </div>
              <p className="text-[11px] text-zinc-400">Active route guardian tracking</p>
            </div>

            {locationStatus === "granted" ? (
              <span className="inline-flex items-center space-x-1 text-[10px] font-black bg-emerald-500/10 text-emerald-500 px-2.5 py-1 rounded-full">
                <CheckCircle className="w-3 h-3" />
                <span>ACTIVE</span>
              </span>
            ) : locationStatus === "low-accuracy" ? (
              <button
                onClick={triggerLocationPrompt}
                className="text-[10px] font-black text-amber-600 dark:text-amber-400 px-2.5 py-1 rounded-full bg-amber-500/10"
              >
                Enable high-accuracy GPS
              </button>
            ) : locationStatus === "denied" ? (
              <div className="text-right">
                <span className="inline-flex items-center space-x-1 text-[10px] font-black bg-red-500/10 text-red-500 px-2.5 py-1 rounded-full mb-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>DENIED</span>
                </span>
                <p className="text-[9px] text-zinc-400">Reset in browser settings</p>
              </div>
            ) : locationStatus === "requesting" ? (
              <span className="inline-flex items-center space-x-1.5 text-[10px] font-black text-yellow-500">
                <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                <span>Acquiring High-Precision GPS...</span>
              </span>
            ) : (
              <button
                onClick={triggerLocationPrompt}
                className="bg-yellow-400 text-black font-black px-3 py-1.5 rounded-full text-xs active:scale-95 transition-all shadow-sm"
              >
                Allow 📍
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}