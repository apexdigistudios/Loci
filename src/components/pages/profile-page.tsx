"use client";

import React, { useState } from "react";
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
} from "lucide-react";

interface ProfilePageProps {
  fullName: string;
  nickname: string;
  userPhone: string;
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
  notificationPermission,
  locationStatus,
  locationCoords,
  triggerNotificationPrompt,
  triggerLocationPrompt,
  onLogout,
}: ProfilePageProps) {
  const [subView, setSubView] = useState<"profile" | "settings">("profile");

  return (
    <div className="space-y-5">
      {/* iOS Segmented Control Header */}
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
            <div className="w-20 h-20 mx-auto rounded-full bg-zinc-900 text-yellow-400 border-2 border-yellow-400 font-black text-2xl flex items-center justify-center uppercase shadow-md">
              {nickname ? nickname.slice(0, 2) : "ME"}
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
            <h3 className="text-sm font-black text-black dark:text-white">Permissions & Security ⚙️</h3>
            <p className="text-[11px] text-zinc-400">Configure device access and location options.</p>
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