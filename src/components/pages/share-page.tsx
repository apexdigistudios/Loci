"use client";

import React, { useState, useEffect } from "react";
import { Share2, Copy, Check, Send, Sparkles, Shield, MessageSquare, Users, UserCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface SharePageProps {
  nickname: string;
  userPhone: string;
}

interface ReferredUser {
  referred_phone: string;
  created_at: string;
}

export function SharePage({ nickname, userPhone }: SharePageProps) {
  const [copied, setCopied] = useState(false);
  const [referrals, setReferrals] = useState<ReferredUser[]>([]);
  const [loading, setLoading] = useState(true);

  const refCode = nickname || userPhone;

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/join?ref=${encodeURIComponent(refCode)}`
    : `https://deloci.online/join?ref=${encodeURIComponent(refCode)}`;

  const shareText = `Hey! Join me on Déloci so we can watch over each other when walking home safely. 🛡️🚀`;

  useEffect(() => {
    let isMounted = true;

    async function fetchReferralStats() {
      if (!refCode) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("referrals")
          .select("referred_phone, created_at")
          .eq("referrer_phone", refCode)
          .order("created_at", { ascending: false });

        if (error) throw error;

        if (isMounted && data) {
          setReferrals(data as ReferredUser[]);
        }
      } catch (err) {
        console.error("Failed to load referral stats:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchReferralStats();

    return () => {
      isMounted = false;
    };
  }, [refCode]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join Déloci Safety Network",
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        console.error("Error sharing:", err);
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="space-y-5 pt-1">
      {/* Page Header */}
      <div>
        <h2 className="text-base font-black text-black dark:text-white flex items-center space-x-1.5">
          <span>Tell Your People About Déloci</span>
          <span>🚀</span>
        </h2>
        <p className="text-[11px] text-zinc-400">
          Share your personal link to family and friends so you can protect each other.
        </p>
      </div>

      {/* Network Stats Banner */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3.5 flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4 text-yellow-500" />
          </div>
          <div>
            <p className="text-[10px] text-zinc-400 font-medium">Joined Circle</p>
            <p className="text-base font-black text-black dark:text-white">
              {loading ? "..." : referrals.length}
            </p>
          </div>
        </div>

        <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3.5 flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <UserCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <p className="text-[10px] text-zinc-400 font-medium">Auto-Guardians</p>
            <p className="text-base font-black text-black dark:text-white">
              {loading ? "..." : referrals.length > 0 ? "Active" : "Ready"}
            </p>
          </div>
        </div>
      </div>

      {/* Redesigned Premium Share Card */}
      <div className="relative overflow-hidden rounded-4xl bg-linear-to-b from-zinc-900 via-black to-zinc-950 p-6 border border-zinc-800/80 shadow-2xl space-y-6">
        {/* Glow backdrop effect */}
        <div className="absolute -top-10 -right-10 w-36 h-36 bg-yellow-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between">
          <div className="inline-flex items-center space-x-1.5 bg-yellow-400/10 border border-yellow-400/30 px-3 py-1 rounded-full">
            <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-[10px] font-black uppercase tracking-wider text-yellow-400">
              Invite &amp; Protect
            </span>
          </div>
          <div className="w-9 h-9 rounded-full bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center">
            <Shield className="w-4 h-4 text-yellow-400" />
          </div>
        </div>

        <div className="space-y-1">
          <h3 className="text-2xl font-black tracking-tight text-white leading-tight">
            Safety in Numbers 🛡️
          </h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Invite your trusted friends. Anyone who registers with your link automatically links with your safety circle.
          </p>
        </div>

        {/* Dynamic Referral Code / Link Box */}
        <div className="bg-zinc-950/90 border border-zinc-800 rounded-2xl p-2.5 flex items-center justify-between gap-2 shadow-inner">
          <div className="pl-2 min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-zinc-500">Your Personal Link</p>
            <p className="text-xs font-mono font-bold text-yellow-400 truncate">{shareUrl}</p>
          </div>
          <button
            onClick={handleCopyLink}
            className="px-3 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-500 text-black font-extrabold text-xs active:scale-90 transition-all shrink-0 flex items-center space-x-1.5"
          >
            {copied ? <Check className="w-4 h-4 text-black" /> : <Copy className="w-4 h-4 text-black" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>

        {/* Share Action Button */}
        <button
          onClick={handleNativeShare}
          className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-black py-4 rounded-2xl text-xs tracking-wider uppercase transition-all flex items-center justify-center space-x-2 active:scale-[0.98] shadow-xl shadow-yellow-400/10"
        >
          <Share2 className="w-4 h-4" />
          <span>SEND INVITE TO FRIENDS</span>
        </button>
      </div>

      {/* Quick Share Buttons */}
      <div className="grid grid-cols-2 gap-2.5">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`${shareText}${shareUrl}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center space-x-3 text-emerald-500 active:scale-95 transition-all"
        >
          <Send className="w-5 h-5 shrink-0" />
          <div className="text-left">
            <p className="text-xs font-extrabold text-black dark:text-white">WhatsApp</p>
            <p className="text-[10px] text-zinc-400">Share with squad</p>
          </div>
        </a>

        <a
          href={`sms:?body=${encodeURIComponent(`${shareText}${shareUrl}`)}`}
          className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex items-center space-x-3 text-blue-500 active:scale-95 transition-all"
        >
          <MessageSquare className="w-5 h-5 shrink-0" />
          <div className="text-left">
            <p className="text-xs font-extrabold text-black dark:text-white">SMS Message</p>
            <p className="text-[10px] text-zinc-400">Send direct text</p>
          </div>
        </a>
      </div>

      {/* Circle Members Joined List */}
      <div className="pt-2">
        <h4 className="text-xs font-extrabold text-black dark:text-white uppercase tracking-wider mb-3">
          Circle Members Joined ({referrals.length})
        </h4>

        {loading ? (
          <div className="text-xs text-zinc-400 py-3 text-center">Loading network activity...</div>
        ) : referrals.length === 0 ? (
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-center">
            <p className="text-xs text-zinc-400">No friends have joined via your link yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {referrals.map((item, idx) => (
              <div
                key={idx}
                className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 flex items-center justify-between"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-yellow-400/20 text-yellow-500 font-extrabold text-xs flex items-center justify-center">
                    {(item.referred_phone || "U").slice(-2)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-black dark:text-white">
                      {item.referred_phone}
                    </p>
                    <p className="text-[10px] text-zinc-400">
                      {new Date(item.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-extrabold bg-emerald-500/10 text-emerald-500 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  Protected 🛡️
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}