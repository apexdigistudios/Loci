"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Shield, ArrowRight, UserCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";

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
        const { data } = await supabase
          .from("users")
          .select("full_name, nickname")
          .or(`phone.eq.${refCode},nickname.eq.${refCode}`)
          .maybeSingle();

        if (data) {
          setReferrerName(data.nickname || data.full_name || refCode);
        } else {
          setReferrerName(refCode);
        }
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
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col justify-between p-6 max-w-md mx-auto">
      {/* Top Header */}
      <div className="pt-8 flex items-center space-x-2">
        <div className="w-9 h-9 rounded-xl bg-yellow-400 text-black font-black flex items-center justify-center">
          <Shield className="w-5 h-5" />
        </div>
        <span className="text-lg font-bold tracking-tight">Déloci</span>
      </div>

      {/* Main Invitation Body */}
      <div className="space-y-6 my-auto py-12">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-4 w-32 bg-zinc-800 rounded" />
            <div className="h-8 w-64 bg-zinc-800 rounded" />
          </div>
        ) : (
          <>
            {referrerName && (
              <div className="inline-flex items-center space-x-2 bg-zinc-900 border border-zinc-800 px-3.5 py-1.5 rounded-full">
                <UserCheck className="w-4 h-4 text-yellow-400" />
                <span className="text-xs text-zinc-300">
                  Invited by <strong className="text-white">{referrerName}</strong>
                </span>
              </div>
            )}

            <div className="space-y-3">
              <h1 className="text-3xl font-extrabold tracking-tight leading-tight">
                Walk home safely, together.
              </h1>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Déloci is a consent-based personal safety check-in app. Join to automatically link with {referrerName || "your contacts"} and stay protected during late walks and travel.
              </p>
            </div>
          </>
        )}

        <div className="space-y-3 pt-4 border-t border-zinc-900">
          <div className="flex items-start space-x-3 text-xs text-zinc-300">
            <span className="text-yellow-400 font-bold">1.</span>
            <p>Create your account with your phone number.</p>
          </div>
          <div className="flex items-start space-x-3 text-xs text-zinc-300">
            <span className="text-yellow-400 font-bold">2.</span>
            <p>Automatically connect as trusted safety contacts.</p>
          </div>
          <div className="flex items-start space-x-3 text-xs text-zinc-300">
            <span className="text-yellow-400 font-bold">3.</span>
            <p>Start check-in timers whenever you head home.</p>
          </div>
        </div>
      </div>

      {/* Action CTA */}
      <div className="pb-6">
        <button
          onClick={handleContinue}
          className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-4 rounded-2xl text-sm flex items-center justify-center space-x-2 active:scale-[0.98] transition-all"
        >
          <span>Get Started</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950 text-white p-6">Loading...</div>}>
      <JoinContent />
    </Suspense>
  );
}