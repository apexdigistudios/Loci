"use client";

import React, { useState, useEffect } from "react";
import {
  Download,
  Users,
  Clock,
  CheckCircle2,
  Smartphone,
  Share2,
  ShieldAlert,
  Heart,
  Shield,
} from "lucide-react";
import { Hero } from "@/components/hero";
import { LifestyleGallery } from "@/components/lifestyle-gallery";
import { ThemeToggle } from "@/components/theme-toggle";
import { InstallModal } from "@/components/install-modal";
import { Login, UserData } from "@/components/login";
import { MainApp } from "@/components/main-app";
import { ScrollReveal } from "@/components/scroll-reveal";
import { SplashScreen } from "@/components/splash-screen";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const HOW_IT_WORKS_STEPS = [
  {
    stepLabel: "STEP 1 · SETUP",
    icon: <Users className="w-5 h-5 text-black" />,
    title: "Add Trusted Contacts",
    desc: "save people who should receive automatic check-in updates and missed-arrival alerts.",
  },
  {
    stepLabel: "STEP 2 · DEPARTURE",
    icon: <Clock className="w-5 h-5 text-black" />,
    title: "Set Arrival Timer",
    desc: "start a session when leaving or commuting, specifying expected arrival time.",
  },
  {
    stepLabel: "STEP 3 · ARRIVAL",
    icon: <CheckCircle2 className="w-5 h-5 text-black" />,
    title: "Check-In Safely",
    desc: "tap once when you arrive. If time expires without check-in, alerts dispatch automatically.",
  },
  {
    stepLabel: "STEP 4 · AUTOMATED SAFETY",
    icon: <ShieldAlert className="w-5 h-5 text-black" />,
    title: "Gradual Escalation",
    desc: "first reminds you, then alerts contacts gently before escalating, avoiding false alarms.",
  },
];

export default function Home() {
  const [isPWA, setIsPWA] = useState<boolean | null>(null);
  const [splashComplete, setSplashComplete] = useState(false);
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);

  useEffect(() => {
    // 1. Detect PWA Standalone Mode
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    setIsPWA(isStandalone);
    if (isStandalone) {
      const splashTimer = window.setTimeout(() => setSplashComplete(true), 1700);
      const handleInstallWhileStarting = (event: Event) => {
        event.preventDefault();
        setDeferredPrompt(event as BeforeInstallPromptEvent);
      };
      window.addEventListener("beforeinstallprompt", handleInstallWhileStarting);
      return () => {
        window.clearTimeout(splashTimer);
        window.removeEventListener("beforeinstallprompt", handleInstallWhileStarting);
      };
    }

    // 2. Capture install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  if (isPWA === null || (isPWA && !splashComplete)) {
    return isPWA ? <SplashScreen /> : null;
  }

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setDeferredPrompt(null);
      }
    } else {
      setIsInstallModalOpen(true);
    }
  };

  const handleLoginSuccess = (data: UserData) => {
    localStorage.setItem("loci_user_phone", data.phone);
    setUserPhone(data.phone);
  };

  const handleLogout = () => {
    localStorage.removeItem("loci_user_phone");
    setUserPhone(null);
  };

  // --- PWA STRICT ROUTING (Bypasses landing page entirely) ---
  if (isPWA) {
    if (!userPhone) {
      return <Login onSuccess={handleLoginSuccess} showSplash={false} />;
    }
    return <MainApp userPhone={userPhone} onLogout={handleLogout} />;
  }

  // --- LANDING PAGE (Web Browser Visitors Only) ---
  return (
    <div className="min-h-screen bg-white dark:bg-black text-zinc-900 dark:text-zinc-100 flex flex-col justify-between font-sans antialiased selection:bg-yellow-400 selection:text-black">
      <InstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />

      <header className="sticky top-0 z-50 border-b border-zinc-200 dark:border-zinc-800/80 bg-white/80 dark:bg-black/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <img src="/loci-light.png" alt="Déloci Logo" className="h-10 w-auto object-contain shrink-0 dark:hidden" />
            <img src="/loci-dark.png" alt="Déloci Logo" className="hidden h-10 w-auto object-contain shrink-0 dark:block" />
          </div>

          <div className="flex items-center space-x-3">
            <ThemeToggle />
            <button
              onClick={handleInstallClick}
              className="text-xs font-extrabold bg-yellow-400 hover:bg-yellow-500 text-black px-4 py-2 rounded-xl transition-all flex items-center space-x-1.5 shadow-sm active:scale-[0.98]"
            >
              <Download className="w-3.5 h-3.5 text-black" />
              <span>Install App</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 space-y-20 pb-20 overflow-hidden">
        <Hero />

        <ScrollReveal>
          <LifestyleGallery />
        </ScrollReveal>

        {/* Vertical Flow How It Works Section */}
        <ScrollReveal>
          <section id="how-it-works" className="space-y-10 py-6 max-w-2xl mx-auto px-6">
            <div className="text-center space-y-2">
              <ScrollReveal delay={0.08}>
                <span className="text-[10px] font-black uppercase tracking-widest bg-yellow-400 text-black px-3.5 py-1.5 rounded-full shadow-sm">
                  How Déloci Works
                </span>
              </ScrollReveal>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-black dark:text-white tracking-tight">
                Consent-First Safety. Zero Spying.
              </h2>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                How your journey is protected every step of the way.
              </p>
            </div>

            <div className="relative pl-2 sm:pl-4 space-y-8">
              {/* Vertical Connecting Line */}
              <div className="absolute left-5.75 sm:left-7.75 top-6 bottom-6 w-0.5 bg-yellow-400/50 dark:bg-yellow-400/30" />

              {HOW_IT_WORKS_STEPS.map((step, idx) => (
                <ScrollReveal key={idx} delay={idx * 0.1}>
                  <div className="flex items-start gap-4 sm:gap-6 relative z-10">
                    {/* Step Icon Badge */}
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-yellow-400 text-black flex items-center justify-center shrink-0 border-4 border-white dark:border-black shadow-md">
                      {step.icon}
                    </div>

                    {/* Step Details */}
                    <div className="pt-1 space-y-1">
                      <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-widest text-yellow-600 dark:text-yellow-400 block">
                        {step.stepLabel}
                      </span>
                      <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-300 leading-relaxed">
                        <strong className="text-black dark:text-white font-extrabold">{step.title}</strong> — {step.desc}
                      </p>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </section>
        </ScrollReveal>

        {/* Founder Story Section */}
        <ScrollReveal>
          <section id="story" className="max-w-2xl mx-auto px-6 text-center space-y-6 pt-6">
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-zinc-100 dark:border-zinc-800 shadow-md mx-auto bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
              <img
                src="/founders.png"
                alt="Founder of Déloci"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
              <Shield className="w-10 h-10 text-yellow-400" />
            </div>

            <div>
              <span className="inline-flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-500 dark:text-rose-400 font-bold text-xs px-3.5 py-1 rounded-full border border-rose-100 dark:border-rose-900/30">
                <Heart className="w-3.5 h-3.5 fill-current" />
                <span>made with love for safer journeys</span>
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-black dark:text-white tracking-tight lowercase">
              why we built déloci
            </h2>

            <div className="space-y-4 text-sm sm:text-base font-normal text-zinc-600 dark:text-zinc-300 leading-relaxed lowercase text-center max-w-xl mx-auto">
              <p>
                we constantly hear alarming stories of missing persons, sudden disappearances, and late‑night emergencies. whether it’s moving to a new city, meeting someone new for the first time, or heading out alone, the uncertainty and worry felt by relatives, friends, and loved ones watching from afar can be overwhelming.
              </p>

              <p>
                connecting with new people and stepping out should bring excitement, not fear. i wanted to build a way for anyone to step into any situation — from late commutes to first dates — knowing that their <strong className="font-extrabold text-black dark:text-white">trusted circle is silently watching over them</strong>, ready to be alerted the exact moment something feels off.
              </p>

              <p>
                with déloci, you share your live location and where you’re going with the people you trust. if you don’t check in as expected, <strong className="font-extrabold text-black dark:text-white">they’re alerted automatically — even if you can’t reach for your phone.</strong> you control who sees what, and only the people you choose are notified when it matters.
              </p>

              <p>
                we dedicated myself to creating déloci to offer real reassurance to distant loved ones and help ensure that when something goes wrong, the right people know fast.
              </p>

              <p className="font-bold text-black dark:text-white pt-2">
                — founder, déloci 🫶
              </p>
            </div>
          </section>
        </ScrollReveal>

        {/* Install Section - Image Matching Banner */}
        <ScrollReveal>
          <section id="install" className="max-w-3xl mx-auto px-6">
            <div className="relative overflow-hidden bg-black text-white dark:bg-zinc-900 border border-zinc-800 rounded-[36px] sm:rounded-[44px] p-8 sm:p-14 text-center space-y-6 shadow-2xl">
              {/* Corner Circular Background Glows */}
              <div className="absolute -top-12 -right-12 w-60 h-60 rounded-full bg-yellow-400/15 blur-2xl pointer-events-none" />
              <div className="absolute -bottom-12 -left-12 w-60 h-60 rounded-full bg-yellow-400/15 blur-2xl pointer-events-none" />

              {/* Main Banner Heading */}
              <h2 className="relative z-10 text-3xl sm:text-5xl font-black text-white tracking-tight lowercase max-w-lg mx-auto leading-[1.15]">
                install déloci directly on your phone or computer
              </h2>

              {/* Subtitle */}
              <p className="relative z-10 text-xs sm:text-sm text-zinc-300 font-medium max-w-md mx-auto lowercase leading-relaxed">
                no app store required — install directly from your browser for native standalone access :)
              </p>

              {/* Side-by-Side Pill Buttons (Stack on Mobile) */}
              <div className="relative z-10 pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={handleInstallClick}
                  className="w-full sm:w-auto bg-white hover:bg-zinc-100 text-black font-extrabold px-7 py-3.5 rounded-full text-xs sm:text-sm transition-all flex items-center justify-center space-x-2 shadow-lg active:scale-95"
                >
                  <Smartphone className="w-4 h-4 text-black shrink-0" />
                  <span>ios safari</span>
                </button>

                <button
                  onClick={handleInstallClick}
                  className="w-full sm:w-auto bg-white/15 hover:bg-white/25 text-white font-extrabold px-7 py-3.5 rounded-full text-xs sm:text-sm transition-all flex items-center justify-center space-x-2 border border-white/20 backdrop-blur-md active:scale-95"
                >
                  <Share2 className="w-4 h-4 text-white shrink-0" />
                  <span>android / chrome</span>
                </button>
              </div>
            </div>
          </section>
        </ScrollReveal>
      </main>

      <ScrollReveal>
        <footer className="border-t border-zinc-200 dark:border-zinc-900 py-10 px-6 bg-zinc-50/50 dark:bg-zinc-950/50">
          <div className="max-w-6xl mx-auto flex flex-col items-center justify-center space-y-4 text-center">
            <div className="flex items-center space-x-2">
              <img src="/loci-light.png" alt="Déloci" className="h-8 w-auto object-contain shrink-0 opacity-90 dark:hidden" />
              <img src="/loci-dark.png" alt="Déloci" className="hidden h-8 w-auto object-contain shrink-0 opacity-90 dark:block" />
            </div>

            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm">
              Déloci Safety Check-In &bull; Consent-First, Automated &amp; Transparent
            </p>

            <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-semibold text-zinc-500 dark:text-zinc-400 pt-2">
              <a href="#how-it-works" className="hover:text-black dark:hover:text-white transition-colors">How It Works</a>
              <a href="#story" className="hover:text-black dark:hover:text-white transition-colors">Our Story</a>
              <a href="#install" className="hover:text-black dark:hover:text-white transition-colors">Install App</a>
            </div>

            <p className="text-[11px] text-zinc-400 dark:text-zinc-600 pt-2">
              © {new Date().getFullYear()} Déloci. All rights reserved.
            </p>
          </div>
        </footer>
      </ScrollReveal>
    </div>
  );
}