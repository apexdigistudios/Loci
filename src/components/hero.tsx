"use client";

import React from "react";
import { ArrowRight, CheckCircle2, Shield, MapPin, Users } from "lucide-react";
import { Globe } from "@/components/ui/globe";
import { ScrollReveal } from "@/components/scroll-reveal";

export function Hero() {
  return (
    <div className="w-full space-y-12">
      {/* 1. Primary Hero Section */}
      <ScrollReveal>
      <section 
        className="relative min-h-[85vh] lg:min-h-170 flex items-center justify-center bg-cover bg-right sm:bg-center bg-no-repeat overflow-hidden" 
        style={{ backgroundImage: "url('/hero.png')" }}
      >
        {/* Left-to-Right Dark Gradient Overlay for Maximum Text Contrast */}
        <div className="absolute inset-0 bg-linear-to-r from-black/95 via-black/70 to-black/20 dark:from-black/95 dark:via-black/80 dark:to-black/30 pointer-events-none" />

        {/* Floating Ambient Stickers (Desktop Only) */}
        <ScrollReveal className="hidden xl:block absolute bottom-8 right-6 z-20" delay={0.15}>
          <div className="flex bg-yellow-400 text-black px-4 py-2.5 rounded-2xl shadow-2xl font-black text-xs -rotate-3">
            <MapPin className="w-4 h-4 mr-1.5 inline fill-black" />
            <span>Arrived Safely in Osu, Accra</span>
          </div>
        </ScrollReveal>

        <ScrollReveal className="hidden xl:block absolute bottom-16 right-16 z-20" delay={0.25}>
          <div className="flex bg-black/90 text-white border border-zinc-800 px-4 py-3 rounded-2xl shadow-2xl text-xs space-x-3 rotate-2 backdrop-blur-md">
            <div className="w-8 h-8 rounded-xl bg-yellow-400 text-black flex items-center justify-center font-bold">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <p className="font-extrabold text-white">Trusted Contacts</p>
              <p className="text-[10px] text-zinc-400">2 people watching over your walk</p>
            </div>
          </div>
        </ScrollReveal>

        {/* Main Content Area */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 py-16 w-full">
          <div className="max-w-xl lg:max-w-2xl flex flex-col items-start text-left space-y-6">
            
            {/* Safety Badge */}
            <ScrollReveal delay={0.08}>
              <span className="inline-flex items-center space-x-2 text-xs font-black uppercase tracking-widest bg-yellow-400 text-black px-3.5 py-1.5 rounded-full shadow-md">
                <Shield className="w-3.5 h-3.5 fill-black text-yellow-400" />
                <span>Consent-Based Safety</span>
              </span>
            </ScrollReveal>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.1] drop-shadow-sm">
              Know They're Safe. <br />
              <span className="text-yellow-400">Before You Need To Know.</span>
            </h1>

            {/* Sub-description */}
            <p className="text-zinc-300 text-sm sm:text-base leading-relaxed max-w-lg font-medium">
              Keep the people you trust aware of where you are, from the moment you leave until the moment you return safely.
            </p>

            {/* Call to Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3.5 w-full pt-2">
              <a
                href="#install"
                className="w-full sm:w-auto bg-yellow-400 hover:bg-yellow-500 text-black font-extrabold px-8 py-4 rounded-2xl text-sm transition-all flex items-center justify-center space-x-2 active:scale-[0.98] shadow-xl shadow-yellow-400/20"
              >
                <span>Install App on Phone</span>
                <ArrowRight className="w-4 h-4 text-black" />
              </a>
              <a
                href="#how-it-works"
                className="w-full sm:w-auto bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-md px-6 py-4 rounded-2xl text-sm transition-all text-center font-bold active:scale-[0.98]"
              >
                How it works
              </a>
            </div>

            {/* Feature Checkmarks */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full pt-6 border-t border-white/15">
              <ScrollReveal delay={0.1}>
              <div className="flex items-center space-x-2 text-xs text-zinc-200 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Zero Spying</span>
              </div>
              </ScrollReveal>
              <ScrollReveal delay={0.2}>
              <div className="flex items-center space-x-2 text-xs text-zinc-200 font-bold">
                <CheckCircle2 className="w-4 h-4 text-yellow-400 shrink-0" />
                <span>Gradual Alerts</span>
              </div>
              </ScrollReveal>
              <ScrollReveal delay={0.3}>
              <div className="flex items-center space-x-2 text-xs text-zinc-200 font-bold">
                <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                <span>No App for Contacts</span>
              </div>
              </ScrollReveal>
            </div>

          </div>
        </div>
      </section>
      </ScrollReveal>

      {/* 2. Globe Section */}
      <ScrollReveal>
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
      </ScrollReveal>
    </div>
  );
}