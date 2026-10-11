"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Shield, Sparkles } from "lucide-react";

function JoinHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const referrerNickname = searchParams.get("ref");

    if (referrerNickname) {
      // Save referrer nickname to localStorage for signup auto-linking
      localStorage.setItem("loci_referrer_nickname", referrerNickname);
    }

    // Redirect to root signup/login flow after capturing parameter
    const timer = setTimeout(() => {
      router.replace("/");
    }, 1200);

    return () => clearTimeout(timer);
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
      <div className="relative">
        <div className="w-16 h-16 rounded-full bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center animate-pulse">
          <Shield className="w-8 h-8 text-yellow-400" />
        </div>
        <Sparkles className="w-5 h-5 text-yellow-400 absolute -top-1 -right-1 animate-bounce" />
      </div>

      <div className="space-y-1 max-w-xs">
        <h1 className="text-lg font-black tracking-tight text-white">
          Joining Safety Network...
        </h1>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Connecting you to your trusted circle on Déloci 🛡️
        </p>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Shield className="w-8 h-8 text-yellow-400 animate-pulse" />
      </div>
    }>
      <JoinHandler />
    </Suspense>
  );
}