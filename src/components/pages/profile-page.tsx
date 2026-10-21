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
  X,
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
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [testPushBusy, setTestPushBusy] = useState(false);
  const [testPushResult, setTestPushResult] = useState("");
  const [activeAdIndex, setActiveAdIndex] = useState(0);
  const [checkoutLoading, setCheckoutLoading] = useState<"monthly" | "yearly" | null>(null);

  // Initialize from localStorage instantly to prevent any free-tier flash
  const [dbTier, setDbTier] = useState<"free" | "plus">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("deloci_user_tier") as "free" | "plus") || "free";
    }
    return "free";
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { theme, setTheme } = useTheme();
  const { tier: hookTier } = useSubscription(userId || undefined);

  // Fetch and sync subscription from Supabase in the background
  useEffect(() => {
    if (!userId) return;

    async function fetchSubscription() {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("tier, status")
        .eq("user_id", userId);

      if (!error && data && data.length > 0) {
        const hasPlus = data.some((sub) => sub.tier === "plus" || sub.status === "active");
        if (hasPlus) {
          setDbTier("plus");
          localStorage.setItem("deloci_user_tier", "plus");
        } else {
          setDbTier("free");
          localStorage.setItem("deloci_user_tier", "free");
        }
      }
    }

    fetchSubscription();

    const channel = supabase
      .channel(`sub_changes_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "subscriptions",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newRow = payload.new as { tier?: string; status?: string };
          if (newRow?.tier === "plus" || newRow?.status === "active") {
            setDbTier("plus");
            localStorage.setItem("deloci_user_tier", "plus");
          } else {
            setDbTier("free");
            localStorage.setItem("deloci_user_tier", "free");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const tier = hookTier === "plus" || dbTier === "plus" ? "plus" : "free";

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
    <div className="w-full max-w-md mx-auto space-y-4 px-3 sm:px-0 pb-12">
      <input
        type="file"
        ref={fileInputRef}
        accept="image/jpeg,image/png,image/webp,image/heic"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* WHATSAPP STYLE AVATAR VIEWER MODAL (WITHOUT BORDER OUTLINE) */}
      {showAvatarModal && (
        <div className="fixed inset-0 z-9999 bg-black/95 backdrop-blur-lg flex flex-col items-center justify-between p-6 animate-in fade-in">
          <div className="w-full flex justify-between items-center max-w-md pt-2">
            <button
              type="button"
              onClick={() => setShowAvatarModal(false)}
              className="p-2 rounded-full bg-white/10 text-white flex items-center justify-center active:scale-95 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
            <span className="text-xs font-mono font-bold uppercase text-yellow-400 tracking-wider">Profile Photo</span>
            <div className="w-10" />
          </div>

          {/* Clean preview container without yellow border */}
          <div className="w-full max-w-xs aspect-square rounded-3xl overflow-hidden bg-zinc-900 shadow-2xl flex items-center justify-center my-auto relative">
            {currentAvatar ? (
              <img
                src={currentAvatar}
                alt={nickname || "Profile Avatar"}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-yellow-400 font-black text-6xl">
                {nickname ? nickname.slice(0, 2) : "ME"}
              </span>
            )}
          </div>

          <div className="w-full max-w-md space-y-3 pb-4">
            <button
              type="button"
              onClick={() => {
                setShowAvatarModal(false);
                fileInputRef.current?.click();
              }}
              disabled={uploadingAvatar}
              className="w-full bg-yellow-400 hover:bg-yellow-300 text-black p-3.5 rounded-2xl font-black text-xs flex items-center justify-center space-x-2 active:scale-[0.98] transition-all shadow-lg"
            >
              {uploadingAvatar ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4 stroke-[2.5]" />
                  <span>Change Photo</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

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
        <div className="space-y-4 animate-in fade-in slide-in-from-right-3">
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
          <div className="bg-zinc-900 text-white rounded-3xl p-5 border border-yellow-400/30 text-center relative overflow-hidden space-y-3 shadow-xl">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Shield className="w-32 h-32 text-yellow-400" />
            </div>
            <div className="absolute inset-0 bg-linear-to-t from-black via-transparent to-transparent pointer-events-none" />

            <div className="relative z-10 w-12 h-12 rounded-2xl bg-yellow-400 text-black flex items-center justify-center mx-auto shadow-lg shadow-yellow-400/30">
              <Sparkles className="w-6 h-6 fill-black" />
            </div>

            <div className="relative z-10 space-y-1">
              <h2 className="text-lg font-black text-white">Unlock Full Safety Control</h2>
              <p className="text-[11px] text-zinc-300 max-w-xs mx-auto">
                Get unlimited trusted contacts, circle groups, and priority emergency dispatch.
              </p>
            </div>

            {/* Ads Carousel */}
            <div className="relative z-10 bg-white/10 dark:bg-zinc-800/80 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 text-left">
              <span className="text-[8px] font-black uppercase text-yellow-400 tracking-widest block mb-0.5">
                {PLUS_ADS[activeAdIndex].tag}
              </span>
              <h4 className="text-[11px] font-extrabold text-white">{PLUS_ADS[activeAdIndex].title}</h4>
              <p className="text-[10px] text-zinc-300">{PLUS_ADS[activeAdIndex].desc}</p>
              
              <div className="flex justify-center gap-1.5 pt-2.5">
                {PLUS_ADS.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-1 rounded-full transition-all duration-300 ${
                      idx === activeAdIndex ? "w-5 bg-yellow-400" : "w-1.5 bg-zinc-600"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Benefits list */}
          <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border border-zinc-200/50 dark:border-zinc-800/50 rounded-3xl p-4 space-y-3 shadow-sm">
            <h3 className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Plus Features Included</h3>
            <div className="space-y-2.5">
              {UPGRADE_BENEFITS.map((b, idx) => (
                <div key={idx} className="flex items-start space-x-2.5">
                  <div className="w-4 h-4 rounded-full bg-yellow-400/20 text-yellow-500 flex items-center justify-center shrink-0 mt-0.5 border border-yellow-400/40">
                    <Check className="w-2.5 h-2.5 stroke-3" />
                  </div>
                  <div>
                    <h4 className="text-[11px] font-extrabold text-black dark:text-white">{b.title}</h4>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing Options */}
          <div className="grid grid-cols-1 gap-2.5">
            <button
              type="button"
              onClick={() => openPaddleCheckout("monthly")}
              disabled={checkoutLoading !== null}
              className="w-full bg-yellow-400 hover:bg-yellow-300 text-black p-3.5 rounded-2xl flex items-center justify-between active:scale-[0.98] transition-all shadow-md shadow-yellow-400/20 disabled:opacity-50"
            >
              <div className="text-left">
                <span className="text-[9px] font-black uppercase bg-black text-yellow-400 px-2 py-0.5 rounded-full">Monthly Plan</span>
                <p className="text-sm font-black mt-0.5">$2.99 <span className="text-[10px] font-bold text-zinc-800">/ mo</span></p>
              </div>
              <div className="flex items-center space-x-1 font-extrabold text-[11px] bg-black text-yellow-400 px-3.5 py-2 rounded-xl">
                {checkoutLoading === "monthly" ? <Loader2 className="w-3.5 h-3.5 animate-spin text-yellow-400" /> : <span>Subscribe</span>}
              </div>
            </button>

            <button
              type="button"
              onClick={() => openPaddleCheckout("yearly")}
              disabled={checkoutLoading !== null}
              className="w-full bg-zinc-900 dark:bg-white text-white dark:text-black p-3.5 rounded-2xl flex items-center justify-between active:scale-[0.98] transition-all shadow-md disabled:opacity-50 border border-yellow-400/40 relative overflow-hidden"
            >
              <div className="absolute top-2 right-2 bg-yellow-400 text-black text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                16% OFF
              </div>
              <div className="text-left">
                <span className="text-[9px] font-black uppercase bg-yellow-400 text-black px-2 py-0.5 rounded-full">Yearly Plan</span>
                <p className="text-sm font-black mt-0.5">$29.99 <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-600">/ yr</span></p>
              </div>
              <div className="flex items-center space-x-1 font-extrabold text-[11px] bg-yellow-400 text-black px-3.5 py-2 rounded-xl">
                {checkoutLoading === "yearly" ? <Loader2 className="w-3.5 h-3.5 animate-spin text-black" /> : <span>Subscribe</span>}
              </div>
            </button>
          </div>
        </div>
      ) : subView === "profile" ? (
        <div className="space-y-3.5">
          <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border border-zinc-200/50 dark:border-zinc-800/50 rounded-3xl p-5 text-center space-y-2.5 shadow-sm relative overflow-hidden">
            <div className="relative w-20 h-20 mx-auto group">
              <button
                type="button"
                onClick={() => setShowAvatarModal(true)}
                disabled={uploadingAvatar}
                className="w-full h-full rounded-full overflow-hidden bg-zinc-900 text-yellow-400 border-2 border-yellow-400 font-black text-xl flex items-center justify-center uppercase shadow-md relative active:scale-95 transition-all"
                title="View Profile Photo"
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

                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-white text-[9px] font-extrabold">
                  {uploadingAvatar ? (
                    <Loader2 className="w-4 h-4 animate-spin text-yellow-400" />
                  ) : (
                    <>
                      <Camera className="w-4 h-4 text-yellow-400 mb-0.5" />
                      <span>View</span>
                    </>
                  )}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setShowAvatarModal(true)}
                disabled={uploadingAvatar}
                className="absolute bottom-0 right-0 p-1.5 rounded-full bg-yellow-400 text-black shadow-md border-2 border-white dark:border-black active:scale-90 transition-all disabled:opacity-50"
                title="View Photo"
              >
                {uploadingAvatar ? (
                  <Loader2 className="w-3 h-3 animate-spin text-black" />
                ) : (
                  <Camera className="w-3 h-3 stroke-[2.5]" />
                )}
              </button>
            </div>

            <div>
              <div className="flex items-center justify-center gap-1">
                <h2 className="text-base font-black text-black dark:text-white leading-tight">
                  {fullName || nickname || "Déloci User"}
                </h2>
                {tier === "plus" && (
                  <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-blue-500 text-white shadow-xs" title="Meta Verified Plus Member">
                    <Check className="w-2 h-2 stroke-3" />
                  </span>
                )}
              </div>
              <p className="text-[11px] font-mono font-semibold text-zinc-400 mt-0.5">
                {userPhone}
              </p>
            </div>

            {/* COMPACT MOBILE-FIRST BADGES WITH WRAP */}
            <div className="pt-1 flex justify-center items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center space-x-1 text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-500 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                <ShieldCheck className="w-3 h-3" />
                <span>Protected</span>
              </span>

              {tier === "plus" ? (
                /* COMPACT GREEN PLUS TIER BADGE */
                <span className="inline-flex items-center space-x-1 text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                  <Zap className="w-2.5 h-2.5 fill-current" />
                  <span>PLUS TIER</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 text-[9px] font-black uppercase tracking-wider bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700 px-2.5 py-0.5 rounded-full">
                  <span>FREE TIER</span>
                </span>
              )}
            </div>
          </div>

          <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-3.5 space-y-2.5 text-xs shadow-sm">
            <div className="flex justify-between items-center pb-2 border-b border-zinc-100 dark:border-zinc-800/80">
              <span className="text-zinc-400 font-medium text-[11px]">Full Name</span>
              <span className="font-extrabold text-black dark:text-white truncate max-w-42.5 text-[11px]">{fullName || "—"}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-zinc-100 dark:border-zinc-800/80">
              <span className="text-zinc-400 font-medium text-[11px]">Nickname</span>
              <span className="font-extrabold text-black dark:text-white truncate max-w-42.5 text-[11px]">{nickname || "—"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-400 font-medium text-[11px]">Phone Number</span>
              <span className="font-mono font-extrabold text-black dark:text-white text-[11px]">{userPhone}</span>
            </div>
          </div>

          {/* WhatsApp Style Upgrade Banner */}
          {tier === "free" && userId && (
            <button
              type="button"
              onClick={() => setSubView("upgrade")}
              className="w-full bg-linear-to-r from-yellow-400 to-amber-400 hover:from-yellow-300 hover:to-amber-300 text-black p-3.5 rounded-2xl flex items-center justify-between active:scale-[0.98] transition-all shadow-md shadow-yellow-400/20 group"
            >
              <div className="flex items-center space-x-2.5 text-left">
                <div className="w-9 h-9 rounded-xl bg-black text-yellow-400 flex items-center justify-center shrink-0 shadow-sm">
                  <Zap className="w-4 h-4 fill-yellow-400" />
                </div>
                <div>
                  <h3 className="text-[11px] font-black text-black">Upgrade to Déloci Plus</h3>
                  <p className="text-[10px] font-bold text-zinc-900/80">Unlock unlimited contacts & alerts</p>
                </div>
              </div>
              <div className="w-7 h-7 rounded-full bg-black/10 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                <ChevronRight className="w-3.5 h-3.5 text-black stroke-3" />
              </div>
            </button>
          )}

          <button
            onClick={() => setSubView("settings")}
            className="w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-3.5 flex items-center justify-between text-xs font-extrabold text-black dark:text-white active:scale-[0.98] transition-all shadow-sm"
          >
            <div className="flex items-center space-x-2">
              <Settings className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-[11px]">App Permissions & Settings</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
          </button>

          <button
            onClick={onLogout}
            className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 font-extrabold py-3 rounded-2xl text-[11px] flex items-center justify-center space-x-1.5 active:scale-95 transition-all border border-red-500/20"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log Out of Déloci</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          <div>
            <h3 className="text-xs font-black text-black dark:text-white">App Preferences & Security ⚙️</h3>
            <p className="text-[10px] text-zinc-400">Configure theme appearance and device permissions.</p>
          </div>

          <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-3.5 space-y-2.5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-[11px] font-black text-black dark:text-white">Appearance Theme</p>
                <p className="text-[10px] text-zinc-400">Customize dark or light styling</p>
              </div>
              <span className="text-[9px] font-mono uppercase font-black bg-yellow-400 text-black px-2 py-0.5 rounded-full">
                {theme || "system"}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 pt-1">
              <button
                onClick={() => setTheme("light")}
                className={`py-2 px-2 rounded-xl text-[11px] font-extrabold transition-all border flex items-center justify-center space-x-1 ${
                  theme === "light"
                    ? "bg-yellow-400 text-black border-yellow-400 shadow-sm"
                    : "bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700/60"
                }`}
              >
                <Sun className="w-3 h-3" />
                <span>Light</span>
              </button>

              <button
                onClick={() => setTheme("dark")}
                className={`py-2 px-2 rounded-xl text-[11px] font-extrabold transition-all border flex items-center justify-center space-x-1 ${
                  theme === "dark"
                    ? "bg-yellow-400 text-black border-yellow-400 shadow-sm"
                    : "bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700/60"
                }`}
              >
                <Moon className="w-3 h-3" />
                <span>Dark</span>
              </button>

              <button
                onClick={() => setTheme("system")}
                className={`py-2 px-2 rounded-xl text-[11px] font-extrabold transition-all border flex items-center justify-center space-x-1 ${
                  theme === "system"
                    ? "bg-yellow-400 text-black border-yellow-400 shadow-sm"
                    : "bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700/60"
                }`}
              >
                <Monitor className="w-3 h-3" />
                <span>Auto</span>
              </button>
            </div>
          </div>

          <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-3.5 flex items-center justify-between shadow-sm">
            <div className="space-y-0.5">
              <div className="flex items-center space-x-1.5">
                <Bell className="w-3.5 h-3.5 text-yellow-500" />
                <p className="text-[11px] font-black text-black dark:text-white">Push Notifications</p>
              </div>
              <p className="text-[10px] text-zinc-400">Alerts for safety timer escalation</p>
            </div>

            {notificationPermission === "granted" ? (
              <span className="inline-flex items-center space-x-1 text-[9px] font-black bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full">
                <CheckCircle className="w-2.5 h-2.5" />
                <span>On</span>
              </span>
            ) : notificationPermission === "denied" ? (
              <div className="text-right">
                <span className="inline-flex items-center space-x-1 text-[9px] font-black bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full mb-0.5">
                  <AlertCircle className="w-2.5 h-2.5" />
                  <span>Off</span>
                </span>
                <p className="max-w-32 text-[9px] leading-snug text-zinc-500">Enable in device settings.</p>
              </div>
            ) : (
              <button
                onClick={triggerNotificationPrompt}
                className="bg-yellow-400 text-black font-black px-2.5 py-1 rounded-full text-[11px] active:scale-95 transition-all shadow-sm"
              >
                Allow 🔔
              </button>
            )}
          </div>

          {process.env.NODE_ENV === "development" && (
            <div className="space-y-2 rounded-2xl border border-zinc-200/60 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 p-3.5">
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
                className="w-full rounded-xl bg-yellow-400 py-2.5 text-[11px] font-black text-black disabled:opacity-50"
              >
                {testPushBusy ? "Sending test notification..." : "Send Test Notification"}
              </button>
              {testPushResult && <p role="status" className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-300">{testPushResult}</p>}
            </div>
          )}

          <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-3.5 flex items-center justify-between shadow-sm">
            <div className="space-y-0.5">
              <div className="flex items-center space-x-1.5">
                <MapPin className="w-3.5 h-3.5 text-yellow-500" />
                <p className="text-[11px] font-black text-black dark:text-white">Location Services</p>
              </div>
              <p className="text-[10px] text-zinc-400">Active route guardian tracking</p>
            </div>

            {locationStatus === "granted" ? (
              <span className="inline-flex items-center space-x-1 text-[9px] font-black bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full">
                <CheckCircle className="w-2.5 h-2.5" />
                <span>ACTIVE</span>
              </span>
            ) : locationStatus === "low-accuracy" ? (
              <button
                onClick={triggerLocationPrompt}
                className="text-[9px] font-black text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full bg-amber-500/10"
              >
                Enable high-accuracy
              </button>
            ) : locationStatus === "denied" ? (
              <div className="text-right">
                <span className="inline-flex items-center space-x-1 text-[9px] font-black bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full mb-0.5">
                  <AlertCircle className="w-2.5 h-2.5" />
                  <span>DENIED</span>
                </span>
                <p className="text-[9px] text-zinc-400">Reset in browser</p>
              </div>
            ) : locationStatus === "requesting" ? (
              <span className="inline-flex items-center space-x-1 text-[9px] font-black text-yellow-500">
                <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                <span>Acquiring GPS...</span>
              </span>
            ) : (
              <button
                onClick={triggerLocationPrompt}
                className="bg-yellow-400 text-black font-black px-2.5 py-1 rounded-full text-[11px] active:scale-95 transition-all shadow-sm"
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