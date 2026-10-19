"use client";

import React, { useState, useEffect } from "react";
import { Copy, Check, Send, MessageSquare } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface SharePageProps {
  nickname: string;
  userPhone: string;
}

interface ReferredUser {
  referred_phone: string;
  created_at: string;
  nickname: string | null;
  full_name: string | null;
}

export function SharePage({ nickname, userPhone }: SharePageProps) {
  const [copied, setCopied] = useState(false);
  const [referrals, setReferrals] = useState<ReferredUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [referralError, setReferralError] = useState("");

  const refCode = nickname || userPhone;

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/join?ref=${encodeURIComponent(refCode)}`
    : `https://deloci.online/join?ref=${encodeURIComponent(refCode)}`;

  const shareText = "Join me on Déloci so we can watch over each other when walking home safely:";

  useEffect(() => {
    let cancelled = false;

    async function fetchReferralStats() {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!authData.user) {
          if (!cancelled) {
            setReferrals([]);
            setReferralError("Sign in to view your referral activity.");
          }
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("users")
          .select("phone")
          .eq("id", authData.user.id)
          .single();
        if (profileError) throw profileError;

        const { data, error } = await supabase
          .from("referrals")
          .select("referred_phone, created_at")
          .eq("referrer_phone", profile.phone)
          .order("created_at", { ascending: false });

        if (error) throw error;

        if (!cancelled && data) {
          const referredPhones = data.map((referral) => referral.referred_phone);
          const { data: profiles, error: profilesError } = referredPhones.length
            ? await supabase
                .from("users")
                .select("phone, nickname, full_name")
                .in("phone", referredPhones)
            : { data: [], error: null };
          if (profilesError) throw profilesError;

          const profileByPhone = new Map((profiles ?? []).map((profile) => [profile.phone, profile]));
          setReferrals(data.map((referral) => {
            const profile = profileByPhone.get(referral.referred_phone);
            return {
              ...referral,
              nickname: profile?.nickname ?? null,
              full_name: profile?.full_name ?? null,
            };
          }));
          setReferralError("");
        }
      } catch (err) {
        console.error("Failed to load referral stats:", err);
        if (!cancelled) setReferralError("Referral activity could not be loaded right now.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchReferralStats();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 pt-2 max-w-md mx-auto font-sans">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-black dark:text-white">
          Invite Safety Contacts
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          Share your invite link with family and friends. When they register, they automatically connect to your safety circle.
        </p>
      </div>

      {/* Invite Link Box */}
      <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
        <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
          Your Personal Link
        </label>
        <div className="flex items-center space-x-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5">
          <input
            type="text"
            readOnly
            value={shareUrl}
            className="text-xs font-mono text-zinc-800 dark:text-zinc-200 bg-transparent flex-1 outline-none truncate"
          />
          <button
            onClick={handleCopyLink}
            className="px-3.5 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-bold text-xs rounded-lg transition-colors flex items-center space-x-1.5 shrink-0 active:scale-95"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>

      {/* Quick Messaging Options */}
      <div className="grid grid-cols-2 gap-3">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`${shareText}${shareUrl}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl text-xs transition-colors active:scale-95"
        >
          <Send className="w-4 h-4" />
          <span>WhatsApp</span>
        </a>

        <a
          href={`sms:?body=${encodeURIComponent(`${shareText}${shareUrl}`)}`}
          className="flex items-center justify-center space-x-2 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold py-3 rounded-xl text-xs transition-colors active:scale-95"
        >
          <MessageSquare className="w-4 h-4" />
          <span>SMS Message</span>
        </a>
      </div>

      {/* Connected Members */}
      <div className="pt-2 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            Connected Members
          </h3>
          <span className="text-xs font-bold text-black dark:text-white">
            {referrals.length}
          </span>
        </div>

        {loading ? (
          <div className="text-xs text-zinc-400 py-4 text-center">Loading network activity...</div>
        ) : referralError ? (
          <div role="status" className="p-5 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 text-center">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{referralError}</p>
          </div>
        ) : referrals.length === 0 ? (
          <div className="p-5 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 text-center">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              No contacts have registered with your invite link yet.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {referrals.map((item) => (
              <div
                key={item.referred_phone}
                className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-semibold text-black dark:text-white">
                    {item.nickname || item.full_name || "Déloci member"}
                  </p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    Joined {new Date(item.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  Connected
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}