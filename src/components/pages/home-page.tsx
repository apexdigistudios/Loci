"use client";

import React from "react";
import { Plus, Shield, Sparkles, Clock, ShieldAlert, ChevronRight } from "lucide-react";

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

interface HomePageProps {
  contacts: Contact[];
  activeSession: ActiveSession | null;
  currentBanner: number;
  setCurrentBanner: (i: number) => void;
  banners: Array<{ id: number; tag: string; title: string; desc: string; bg: string }>;
  contactsSupported: boolean;
  handlePickDeviceContact: () => void;
  handleCompleteSession: () => void;
  onNavigate: (tab: "home" | "session" | "contacts" | "profile") => void;
}

export function HomePage({
  contacts,
  activeSession,
  currentBanner,
  setCurrentBanner,
  banners,
  contactsSupported,
  handlePickDeviceContact,
  handleCompleteSession,
  onNavigate,
}: HomePageProps) {
  return (
    <>
      {/* Banner Carousel */}
      <div className="relative overflow-hidden rounded-[26px] shadow-sm">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${currentBanner * 100}%)` }}
        >
          {banners.map((b) => (
            <div
              key={b.id}
              className={`min-w-full p-5 ${b.bg} flex flex-col justify-between h-36 rounded-[26px]`}
            >
              <div className="space-y-1">
                <span className="text-[9px] font-black tracking-widest px-2 py-0.5 rounded-full bg-white/10 backdrop-blur-md inline-block">
                  {b.tag}
                </span>
                <h3 className="text-base font-black tracking-tight leading-snug">{b.title}</h3>
              </div>
              <p className="text-[11px] font-medium opacity-85 leading-snug">{b.desc}</p>
            </div>
          ))}
        </div>

        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex space-x-1 z-10">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentBanner(i)}
              className={`h-1 rounded-full transition-all ${
                currentBanner === i ? "w-4 bg-white" : "w-1 bg-white/30"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Guardian Squad Row */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-black uppercase tracking-wider text-black dark:text-white flex items-center space-x-1.5">
            <span>🛡️ Guardian Squad</span>
            <span className="text-[10px] bg-yellow-400 text-black px-1.5 py-0.2 rounded-full font-black">
              {contacts.length}
            </span>
          </h2>
          <button
            onClick={() => onNavigate("contacts")}
            className="text-[10px] font-bold text-zinc-400 hover:text-yellow-400 transition-colors"
          >
            Manage Contacts 🔥
          </button>
        </div>

        <div className="flex items-center space-x-3 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={contactsSupported ? handlePickDeviceContact : () => onNavigate("contacts")}
            className="w-12 h-12 rounded-full border border-yellow-400/50 bg-yellow-400/10 hover:bg-yellow-400/20 text-yellow-500 flex items-center justify-center shrink-0 active:scale-90 transition-all"
            title="Add Contact"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
          </button>

          {contacts.map((c) => (
            <div key={c.id} className="flex flex-col items-center space-y-1 shrink-0">
              <div className="w-12 h-12 rounded-full bg-zinc-900 text-yellow-400 border border-yellow-400/80 font-black text-xs flex items-center justify-center uppercase shadow-sm">
                {c.name.slice(0, 2)}
              </div>
              <span className="text-[9px] font-bold text-zinc-600 dark:text-zinc-400 max-w-12 truncate">
                {c.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Walk Home Entry Card */}
      {activeSession ? (
        <div className="bg-yellow-400 text-black rounded-[26px] p-5 shadow-lg space-y-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center space-x-1 text-[9px] font-black uppercase tracking-wider bg-black text-yellow-400 px-2.5 py-1 rounded-full">
              <Sparkles className="w-3 h-3 text-yellow-400" />
              <span>Active Journey 🔥</span>
            </span>
            <Clock className="w-4 h-4 text-black" />
          </div>

          <div>
            <p className="text-[9px] font-black uppercase text-black/60 tracking-wider">Destination</p>
            <h2 className="text-xl font-black tracking-tight leading-tight">{activeSession.destination}</h2>
          </div>

          <div className="bg-black/10 backdrop-blur-md p-3 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-[9px] font-bold uppercase text-black/70">ETA</p>
              <p className="text-sm font-black font-mono">
                {new Date(activeSession.expected_arrival_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <ShieldAlert className="w-6 h-6 text-black" />
          </div>

          <button
            onClick={handleCompleteSession}
            className="w-full bg-black hover:bg-zinc-900 text-white font-black py-3.5 rounded-2xl text-xs transition-all flex items-center justify-center space-x-2 active:scale-[0.97]"
          >
            <span>I Arrived Safely! 🎉</span>
          </button>
        </div>
      ) : (
        <div
          onClick={() => onNavigate("session")}
          className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border border-zinc-200/50 dark:border-zinc-800/50 rounded-[26px] p-5 shadow-sm flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all group"
        >
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-yellow-400 text-black rounded-2xl shadow-sm group-hover:scale-105 transition-transform">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-black dark:text-white flex items-center space-x-1">
                <span>Start Walk Home Session</span>
                <span>🚀</span>
              </h2>
              <p className="text-[11px] font-medium text-zinc-400 mt-0.5">
                Configure route &amp; trigger watch shield
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-zinc-400 group-hover:text-black dark:group-hover:text-white transition-colors shrink-0" />
        </div>
      )}
    </>
  );
}