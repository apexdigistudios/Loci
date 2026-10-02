"use client";

import React, { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import {
  Download,
  Users,
  Clock,
  CheckCircle2,
  Smartphone,
  Share2,
  ShieldAlert,
} from "lucide-react";
import { Hero } from "@/components/hero";
import { LifestyleGallery } from "@/components/lifestyle-gallery";
import { ThemeToggle } from "@/components/theme-toggle";
import { InstallModal } from "@/components/install-modal";
import { Login, UserData } from "@/components/login";
import { MainApp } from "@/components/main-app";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const HOW_IT_WORKS_STEPS = [
  {
    icon: <Users className="w-5 h-5 text-black" />,
    title: "1. Add Trusted Contacts",
    desc: "Save people who should receive automatic check-in updates and missed-arrival alerts.",
  },
  {
    icon: <Clock className="w-5 h-5 text-black" />,
    title: "2. Set Arrival Timer",
    desc: "Start a session when leaving or commuting, specifying expected arrival time.",
  },
  {
    icon: <CheckCircle2 className="w-5 h-5 text-black" />,
    title: "3. Check-In Safely",
    desc: "Tap once when you arrive. If time expires without check-in, alerts dispatch automatically.",
  },
  {
    icon: <ShieldAlert className="w-5 h-5 text-black" />,
    title: "4. Gradual Escalation",
    desc: "First reminds you, then alerts contacts gently before escalating, avoiding false alarms.",
  },
];

export default function Home() {
  const { resolvedTheme } = useTheme();
  const logoSrc = resolvedTheme === "dark" ? "/loci-dark.png" : "/loci-light.png";
  const [isPWA, setIsPWA] = useState(false);
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);

  useEffect(() => {
    // 1. Detect PWA Standalone Mode
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) {
      setIsPWA(true);
      // Retrieve persisted session phone if user previously logged in on this device
      const savedPhone = localStorage.getItem("loci_user_phone");
      if (savedPhone) {
        setUserPhone(savedPhone);
      }
    }

    // 2. Capture install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

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
      return <Login onSuccess={handleLoginSuccess} />;
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
            <img src={logoSrc} alt="Loci Logo" className="h-8 w-auto object-contain" />
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

      <main className="flex-1 space-y-16 pb-20 overflow-hidden">
        <Hero />
        <LifestyleGallery />

        <section id="how-it-works" className="space-y-6 py-6">
          <div className="text-center max-w-xl mx-auto px-6 space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest bg-yellow-400 text-black px-3.5 py-1.5 rounded-full shadow-sm">
              How Loci Works
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-black dark:text-white tracking-tight">
              Consent-First Safety. Zero Spying.
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
              Hover over any card to pause the scroll.
            </p>
          </div>

          <div className="relative w-full overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-16 bg-linear-to-r from-white dark:from-black to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-16 bg-linear-to-l from-white dark:from-black to-transparent z-10 pointer-events-none" />

            <div className="animate-marquee flex items-center space-x-6 py-4">
              {[...HOW_IT_WORKS_STEPS, ...HOW_IT_WORKS_STEPS].map((step, idx) => (
                <div
                  key={idx}
                  className="w-70 sm:w-[320px] shrink-0 p-6 bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-3xl space-y-3 shadow-md hover:border-yellow-400 transition-colors"
                >
                  <div className="w-10 h-10 bg-yellow-400 rounded-2xl flex items-center justify-center shadow-sm">
                    {step.icon}
                  </div>
                  <h3 className="text-base font-extrabold text-black dark:text-white">{step.title}</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="install" className="max-w-6xl mx-auto px-6">
          <div className="bg-black text-white dark:bg-zinc-900 border border-zinc-800 rounded-3xl p-8 sm:p-12 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-4 max-w-lg">
              <span className="text-[10px] font-black uppercase tracking-widest bg-yellow-400 text-black px-3 py-1 rounded-md">
                Progressive Web App
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Install Loci Directly on Your Phone or Computer
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                No app store required. Install directly from your browser for native standalone access.
              </p>

              <div className="space-y-2 pt-2 text-xs text-zinc-300">
                <div className="flex items-center space-x-2">
                  <Smartphone className="w-4 h-4 text-yellow-400 shrink-0" />
                  <span><strong>iOS Safari:</strong> Tap Share icon &rarr; "Add to Home Screen"</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Share2 className="w-4 h-4 text-yellow-400 shrink-0" />
                  <span><strong>Chrome / Android:</strong> Click Install App button</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleInstallClick}
              className="bg-yellow-400 hover:bg-yellow-500 text-black font-extrabold px-8 py-4 rounded-2xl text-sm transition-all flex items-center space-x-2 shrink-0 shadow-lg shadow-yellow-400/10 active:scale-[0.98]"
            >
              <Download className="w-5 h-5 text-black" />
              <span>Install App Now</span>
            </button>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-900 py-8 flex flex-col items-center justify-center space-y-2 text-xs text-zinc-500">
        <img src={logoSrc} alt="Loci" className="h-6 w-auto object-contain opacity-80" />
        <p>Loci Safety Check-In &bull; Transparent, Consent-First &amp; Open</p>
      </footer>
    </div>
  );
}