"use client";

import React, { useState, useRef } from "react";
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
} from "lucide-react";
import { useTheme } from "next-themes";
import { supabase } from "@/lib/supabase";

interface ProfilePageProps {
  fullName: string;
  nickname: string;
  userPhone: string;
  avatarUrl?: string;
  onAvatarChange?: (url: string) => void;
  notificationPermission: NotificationPermission;
  locationStatus: "idle" | "granted" | "denied";
  locationCoords: { lat: number; lng: number } | null;
  triggerNotificationPrompt: () => void;
  triggerLocationPrompt: () => void;
  onLogout: () => void;
}

export function ProfilePage({
  fullName,
  nickname,
  userPhone,
  avatarUrl,
  onAvatarChange,
  notificationPermission,
  locationStatus,
  locationCoords,
  triggerNotificationPrompt,
  triggerLocationPrompt,
  onLogout,
}: ProfilePageProps) {
  const [subView, setSubView] = useState<"profile" | "settings">("profile");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [currentAvatar, setCurrentAvatar] = useState<string | undefined>(avatarUrl);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { theme, setTheme } = useTheme();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);

    try {
      const fileExt = file.name.split(".").pop();
      const sanitizedPhone = userPhone.replace(/[^a-zA-Z0-9]/g, "");
      const filePath = `${sanitizedPhone}-${Date.now()}.${fileExt}`;

      // 1. Upload image to Supabase Storage 'avatars' bucket
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        setUploadingAvatar(false);
        return;
      }

      // 2. Get Public URL
      const { data: publicUrlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;

      // 3. Save URL to user record in Supabase database
      const { error: updateError } = await supabase
        .from("users")
        .update({ avatar_url: publicUrl })
        .eq("phone", userPhone);

      if (!updateError) {
        setCurrentAvatar(publicUrl);
        if (onAvatarChange) {
          onAvatarChange(publicUrl);
        }
      } else {
        console.error("Database avatar sync error:", updateError);
      }
    } catch (err) {
      console.error("Failed to upload avatar image:", err);
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <div className="space-y-5">
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Segmented Control Header */}
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

      {/* VIEW 1: PROFILE OVERVIEW */}
      {subView === "profile" && (
        <div className="space-y-4">
          {/* Profile Card */}
          <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border border-zinc-200/50 dark:border-zinc-800/50 rounded-[28px] p-6 text-center space-y-3 shadow-sm relative overflow-hidden">
            {/* Clickable Profile Avatar */}
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
                className="absolute bottom-0 right-0 p-2 rounded-full bg-yellow-400 text-black shadow-md border-2 border-white dark:border-black active:scale-90 transition-all"
                title="Upload Photo"
              >
                <Camera className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>

            <div>
              <h2 className="text-lg font-black text-black dark:text-white leading-tight">
                {fullName || nickname || "Loci User"}
              </h2>
              <p className="text-xs font-mono font-semibold text-zinc-400 mt-0.5">
                {userPhone}
              </p>
            </div>

            <div className="pt-2 flex justify-center">
              <span className="inline-flex items-center space-x-1 text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full border border-emerald-500/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Protected Member</span>
              </span>
            </div>
          </div>

          {/* User Information Stack */}
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

          {/* Quick Nav to Settings */}
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

          {/* Logout Button */}
          <button
            onClick={onLogout}
            className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 font-extrabold py-3.5 rounded-2xl text-xs flex items-center justify-center space-x-2 active:scale-95 transition-all border border-red-500/20"
          >
            <LogOut className="w-4 h-4" />
            <span>Log Out of Loci</span>
          </button>
        </div>
      )}

      {/* VIEW 2: SETTINGS PAGEVIEW */}
      {subView === "settings" && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-black text-black dark:text-white">App Preferences & Security ⚙️</h3>
            <p className="text-[11px] text-zinc-400">Configure theme appearance and device permissions.</p>
          </div>

          {/* Theme Switcher Toggle Card */}
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

          {/* Push Notifications Card */}
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
                <span>ALLOWED</span>
              </span>
            ) : notificationPermission === "denied" ? (
              <div className="text-right">
                <span className="inline-flex items-center space-x-1 text-[10px] font-black bg-red-500/10 text-red-500 px-2.5 py-1 rounded-full mb-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>DENIED</span>
                </span>
                <p className="text-[9px] text-zinc-400">Reset in browser settings</p>
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

          {/* Location Services Card */}
          <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border border-zinc-200/50 dark:border-zinc-800/50 rounded-[26px] p-4 flex items-center justify-between shadow-sm">
            <div className="space-y-0.5">
              <div className="flex items-center space-x-1.5">
                <MapPin className="w-4 h-4 text-yellow-500" />
                <p className="text-xs font-black text-black dark:text-white">Location Services</p>
              </div>
              <p className="text-[11px] text-zinc-400">Active route guardian tracking</p>
            </div>

            {locationStatus === "granted" || locationCoords ? (
              <span className="inline-flex items-center space-x-1 text-[10px] font-black bg-emerald-500/10 text-emerald-500 px-2.5 py-1 rounded-full">
                <CheckCircle className="w-3 h-3" />
                <span>ACTIVE</span>
              </span>
            ) : locationStatus === "denied" ? (
              <div className="text-right">
                <span className="inline-flex items-center space-x-1 text-[10px] font-black bg-red-500/10 text-red-500 px-2.5 py-1 rounded-full mb-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>DENIED</span>
                </span>
                <p className="text-[9px] text-zinc-400">Reset in browser settings</p>
              </div>
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