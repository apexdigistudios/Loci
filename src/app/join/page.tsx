"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Shield, ArrowRight, UserCheck } from "lucide-react";
import Link from "next/link";
import { lookupReferrer } from "@/lib/notification-session";
import { ThemeToggle } from "@/components/theme-toggle";

function JoinContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const refCode = searchParams.get("ref");
  
  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReferrer() {
      if (!refCode) {
        setLoading(false);
        return;
      }

      try {
        const referrer = await lookupReferrer(refCode);
        setReferrerName(referrer?.nickname || referrer?.full_name || refCode);
      } catch (err) {
        console.error("Error fetching inviter info:", err);
        setReferrerName(refCode);
      } finally {
        setLoading(false);
      }
    }

    fetchReferrer();
  }, [refCode]);

  const handleContinue = () => {
    if (typeof window !== "undefined" && refCode) {
      localStorage.setItem("loci_referral_code", refCode);
    }
    router.push("/?signup=true");
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black text-zinc-900 dark:text-zinc-100 flex flex-col justify-between font-sans antialiased selection:bg-yellow-400 selection:text-black">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-200 dark:border-zinc-800/80 bg-white/80 dark:bg-black/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <img src="/loci-light.png" alt="Déloci Logo" className="h-10 w-auto object-contain shrink-0 dark:hidden" />
            <img src="/loci-dark.png" alt="Déloci Logo" className="hidden h-10 w-auto object-contain shrink-0 dark:block" />
          </Link>
          <div className="flex items-center space-x-3">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="max-w-4xl w-full mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 items-center bg-zinc-50/50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-4xl overflow-hidden shadow-sm">
          
          {/* Un-overlapped Hero Image */}
          <div className="w-full h-64 sm:h-80 lg:h-full min-h-75 relative bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
            <img
              src="/join-hero.png"
              alt="Déloci Safety Network Invitation"
              className="w-full h-full object-cover object-center block"
            />
          </div>

          {/* Form / Content Panel */}
          <div className="p-8 sm:p-10 space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center space-x-1.5 bg-yellow-400/10 border border-yellow-400/30 px-3 py-1 rounded-full">
                <Shield className="w-3.5 h-3.5 text-yellow-500" />
                <span className="text-[10px] font-black uppercase tracking-wider text-yellow-600 dark:text-yellow-400">
                  Safety Circle Invite
                </span>
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-black dark:text-white leading-tight">
                  Join {loading ? "..." : referrerName ? referrerName : "Your Friend"} on Déloci 🛡️
                </h1>
                <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Accept this invitation to automatically link your safety circle and watch over each other safely during travel and walks home.
                </p>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 flex items-center space-x-3 shadow-xs">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <UserCheck className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Connection Status</p>
                  <p className="text-xs font-extrabold text-black dark:text-white">
                    {refCode ? `Linked via invite: ${refCode}` : "Direct Safety Registration"}
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 space-y-3">
              <button
                onClick={handleContinue}
                className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-black py-4 rounded-2xl text-xs tracking-wider uppercase transition-all flex items-center justify-center space-x-2 active:scale-[0.98] shadow-xl shadow-yellow-400/10"
              >
                <span>ACCEPT &amp; JOIN NETWORK</span>
                <ArrowRight className="w-4 h-4 text-black" />
              </button>
              <p className="text-[10px] text-center text-zinc-400">
                By joining, you agree to secure consent-based safety check-ins.
              </p>
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-900 py-6 px-6 text-center text-xs text-zinc-500">
        © {new Date().getFullYear()} Déloci. All rights reserved.
      </footer>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white dark:bg-black" />}>
      <JoinContent />
    </Suspense>
  );
}