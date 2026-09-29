"use client";

import React from "react";
import { ArrowRight, CheckCircle2, Shield, MapPin, Users } from "lucide-react";
import { Globe } from "@/components/ui/globe";

export function Hero() {
  return (
    <div className="w-full space-y-12">
      {/* 1. Top Hero Section with Background Splash & Floating Stickers */}
      <section className="relative min-h-[80vh] flex items-center justify-center bg-cover bg-center bg-no-repeat overflow-hidden" style={{ backgroundImage: "url('/hero.png')" }}>
        {/* Dark/Light Backdrop Overlay */}
        <div className="absolute inset-0 bg-white/85 dark:bg-black/85 backdrop-blur-[2px]" />

        {/* Floating Background Accent Stickers */}
        <div className="hidden lg:flex absolute top-16 right-16 z-10 bg-yellow-400 text-black px-4 py-2.5 rounded-2xl shadow-xl font-black text-xs -rotate-6 animate-bounce">
          <MapPin className="w-4 h-4 mr-1.5 inline fill-black" />
          <span>Arrived Safely in Osu, Accra</span>
        </div>

        <div className="hidden lg:flex absolute bottom-20 right-28 z-10 bg-black/90 text-white border border-zinc-800 px-4 py-3 rounded-2xl shadow-2xl text-xs space-x-3 rotate-3">
          <div className="w-8 h-8 rounded-xl bg-yellow-400 text-black flex items-center justify-center font-bold">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <p className="font-extrabold text-white">Trusted Contacts</p>
            <p className="text-[10px] text-zinc-400">2 people watching over your walk</p>
          </div>
        </div>

        {/* Main Hero Banner Content */}
        <div className="relative z-20 max-w-6xl mx-auto px-6 py-20 w-full">
          <div className="max-w-2xl flex flex-col items-start text-left space-y-6">
            <span className="inline-flex items-center space-x-2 text-xs font-black uppercase tracking-widest bg-yellow-400 text-black px-3.5 py-1.5 rounded-full shadow-sm">
              <Shield className="w-3.5 h-3.5 fill-black text-yellow-400" />
              <span>Consent-Based Safety</span>
            </span>

            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-black dark:text-white leading-[1.1]">
              Know They're Safe. <br />
              <span className="text-yellow-500 dark:text-yellow-400">Before You Need To Know.</span>
            </h1>

            <p className="text-zinc-700 dark:text-zinc-300 text-base sm:text-lg leading-relaxed max-w-xl">
              Keep the people you trust aware of where you are, from the moment you leave until the moment you return safely.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full pt-2">
              <a
                href="#install"
                className="w-full sm:w-auto bg-yellow-400 hover:bg-yellow-500 text-black font-extrabold px-8 py-4 rounded-2xl text-sm transition-all flex items-center justify-center space-x-2 active:scale-[0.98] shadow-lg shadow-yellow-400/20"
              >
                <span>Install App on Phone</span>
                <ArrowRight className="w-4 h-4 text-black" />
              </a>
              <a
                href="#how-it-works"
                className="w-full sm:w-auto bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 px-6 py-4 rounded-2xl text-sm transition-all text-center font-bold active:scale-[0.98]"
              >
                How it works
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full pt-6 border-t border-zinc-200/80 dark:border-zinc-800/80">
              <div className="flex items-center space-x-2 text-xs text-zinc-800 dark:text-zinc-200 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Zero Spying</span>
              </div>
              <div className="flex items-center space-x-2 text-xs text-zinc-800 dark:text-zinc-200 font-bold">
                <CheckCircle2 className="w-4 h-4 text-yellow-400 shrink-0" />
                <span>Gradual Alerts</span>
              </div>
              <div className="flex items-center space-x-2 text-xs text-zinc-800 dark:text-zinc-200 font-bold">
                <CheckCircle2 className="w-4 h-4 text-zinc-900 dark:text-zinc-100 shrink-0" />
                <span>No App for Contacts</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Globe Section Below Hero */}
      <section className="border-y border-zinc-200 dark:border-zinc-900 py-16 bg-zinc-50/50 dark:bg-zinc-950/50">
        <div className="max-w-6xl mx-auto px-6 flex flex-col items-center text-center space-y-6">
          <div className="max-w-xl space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-black dark:text-white">
              Global Check-In Network
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
              Real-time safety check-in activity across active corridors worldwide.
            </p>
          </div>

          <div className="flex justify-center w-full pt-4">
            <Globe />
          </div>
        </div>
      </section>
    </div>
  );
}