"use client";

import React from "react";
import { Shield, MapPin, Users, Navigation, CheckCircle2 } from "lucide-react";

export function LifestyleGallery() {
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6 sm:space-y-10 py-4 sm:py-8 select-none">
      <div className="text-center max-w-2xl mx-auto space-y-2 sm:space-y-3">
        <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest bg-yellow-400 text-black px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full shadow-sm">
          Déloci In Real Life
        </span>
        <h2 className="text-2xl sm:text-5xl font-black text-black dark:text-white tracking-tight leading-tight">
          Same plans, different places. <br />
          <span className="text-yellow-500 dark:text-yellow-400">Still connected.</span>
        </h2>
        <p className="text-[11px] sm:text-sm text-zinc-600 dark:text-zinc-400">
          Whether you’re commuting late, meeting someone new, or traveling in a group, Déloci keeps your trusted circle informed without invasive spying.
        </p>
      </div>

      {/* Bento Collage Grid maintaining side-by-side spans across mobile and desktop */}
      <div className="grid grid-cols-12 gap-3 sm:gap-6 items-stretch">
        
        {/* Card 1: Group Outing */}
        <div className="col-span-7 relative group overflow-hidden rounded-2xl sm:rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-zinc-900 min-h-55 sm:min-h-95 flex items-end p-3 sm:p-6 shadow-xl transition-all duration-300 hover:border-yellow-400/50">
          <img
            src="/lifestyle-group.png"
            alt="Group of friends out together"
            className="absolute inset-0 w-full h-full object-cover opacity-85 group-hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black via-black/40 to-transparent" />

          {/* Floating Quote Sticker */}
          <div className="absolute top-2 sm:top-6 left-2 sm:left-6 z-10 bg-yellow-400 text-black px-2 sm:px-4 py-1 sm:py-2 rounded-xl sm:rounded-2xl shadow-lg -rotate-2 font-serif font-bold text-[8px] sm:text-sm">
            "Still connected."
          </div>

          {/* Floating UI Card Sticker */}
          <div className="relative z-10 w-full bg-black/90 backdrop-blur-md border border-zinc-800 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 shadow-2xl space-y-1.5 sm:space-y-3 -rotate-1">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5 sm:pb-2">
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <div className="w-4 h-4 sm:w-6 sm:h-6 rounded bg-yellow-400 text-black flex items-center justify-center font-bold text-[9px] sm:text-xs">
                  <Users className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" />
                </div>
                <span className="text-[10px] sm:text-xs font-bold text-white">Group Déloci</span>
              </div>
              <span className="text-[8px] sm:text-[10px] text-emerald-400 font-semibold bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800">
                Active
              </span>
            </div>

            <div className="space-y-1 sm:space-y-2 text-[9px] sm:text-[11px]">
              <div className="flex items-center justify-between text-zinc-300">
                <div className="flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>You</span>
                </div>
                <span className="text-zinc-500 text-[8px] sm:text-[10px]">At mall</span>
              </div>
              <div className="flex items-center justify-between text-zinc-300">
                <div className="flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                  <span>Emeka</span>
                </div>
                <span className="text-zinc-500 text-[8px] sm:text-[10px]">On way</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Solo Meeting / Date Night */}
        <div className="col-span-5 relative group overflow-hidden rounded-2xl sm:rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-zinc-900 min-h-55 sm:min-h-95 flex items-end p-3 sm:p-6 shadow-xl transition-all duration-300 hover:border-yellow-400/50">
          <img
            src="/meetup.png"
            alt="Meeting someone new"
            className="absolute inset-0 w-full h-full object-cover opacity-85 group-hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black via-black/30 to-transparent" />

          {/* Quote Sticker */}
          <div className="absolute top-2 sm:top-6 right-2 sm:right-6 z-10 bg-white text-black px-2 sm:px-4 py-1 sm:py-2 rounded-xl sm:rounded-2xl shadow-lg rotate-3 font-bold text-[8px] sm:text-xs border border-zinc-200">
            Meeting someone?
          </div>

          {/* Active Session Notification Sticker */}
          <div className="relative z-10 w-full bg-black/90 backdrop-blur-md border border-zinc-800 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 shadow-2xl space-y-1.5 sm:space-y-2 -rotate-1">
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              <div className="w-4 h-4 sm:w-6 sm:h-6 rounded-full bg-yellow-400 text-black flex items-center justify-center font-bold">
                <Shield className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" />
              </div>
              <div>
                <p className="text-[10px] sm:text-xs font-bold text-white leading-tight">Session Active</p>
              </div>
            </div>
            <div className="bg-zinc-900 p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl border border-zinc-800 flex items-center justify-between text-[9px] sm:text-[11px]">
              <span className="text-zinc-400">ETA</span>
              <span className="font-extrabold text-yellow-400">7:00 PM</span>
            </div>
          </div>
        </div>

        {/* Card 3: Late Night Commute */}
        <div className="col-span-5 relative group overflow-hidden rounded-2xl sm:rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-zinc-900 min-h-50 sm:min-h-87.5 flex items-end p-3 sm:p-6 shadow-xl transition-all duration-300 hover:border-yellow-400/50">
          <img
            src="/commute.png"
            alt="Late commute"
            className="absolute inset-0 w-full h-full object-cover opacity-85 group-hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black via-black/40 to-transparent" />

          <div className="relative z-10 w-full space-y-1.5 sm:space-y-3">
            <div className="inline-block bg-yellow-400 text-black font-extrabold text-[8px] sm:text-xs px-2 sm:px-3 py-0.5 sm:py-1 rounded-full -rotate-1">
              Late Commute
            </div>
            <h3 className="text-xs sm:text-xl font-extrabold text-white leading-tight">
              They know you made it home.
            </h3>

            <div className="bg-zinc-950/90 border border-zinc-800 p-2 sm:p-3 rounded-xl sm:rounded-2xl flex items-center justify-between text-[9px] sm:text-xs">
              <div className="flex items-center space-x-1 sm:space-x-2">
                <Navigation className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-400 animate-pulse" />
                <span className="text-zinc-200 font-medium truncate max-w-17.5 sm:max-w-none">Heading home</span>
              </div>
              <span className="font-mono text-zinc-400 text-[8px] sm:text-[11px]">10:30 PM</span>
            </div>
          </div>
        </div>

        {/* Card 4: Airport & Travel Safety */}
        <div className="col-span-7 relative group overflow-hidden rounded-2xl sm:rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-zinc-900 min-h-50 sm:min-h-87.5 flex items-end p-3 sm:p-6 shadow-xl transition-all duration-300 hover:border-yellow-400/50">
          <img
            src="/travel.png"
            alt="Traveling abroad or new city"
            className="absolute inset-0 w-full h-full object-cover opacity-85 group-hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black via-black/30 to-transparent" />

          <div className="absolute top-2 sm:top-6 left-2 sm:left-6 z-10 bg-black/80 backdrop-blur-md border border-zinc-700 text-white px-2 sm:px-3.5 py-0.5 sm:py-1.5 rounded-full text-[8px] sm:text-xs font-bold flex items-center space-x-1 sm:space-x-2">
            <MapPin className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-yellow-400" />
            <span>New City</span>
          </div>

          <div className="relative z-10 w-full flex items-center justify-between gap-2">
            <div className="space-y-0.5 sm:space-y-1">
              <h3 className="text-sm sm:text-2xl font-black text-white leading-tight">Traveling Abroad</h3>
              <p className="text-[9px] sm:text-xs text-zinc-300 hidden sm:block">Share corridor automatically.</p>
            </div>

            <div className="bg-yellow-400 text-black px-2.5 sm:px-4 py-1.5 sm:py-3 rounded-xl sm:rounded-2xl font-extrabold text-[9px] sm:text-xs flex items-center space-x-1 sm:space-x-2 shrink-0 shadow-lg">
              <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 text-black" />
              <span>Active</span>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}