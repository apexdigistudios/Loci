"use client";

import React, { useState } from "react";
import { Share2, Copy, Check, Send, Sparkles, Shield, QrCode } from "lucide-react";

interface SharePageProps {
  nickname: string;
  userPhone: string;
}

export function SharePage({ nickname, userPhone }: SharePageProps) {
  const [copied, setCopied] = useState(false);

  // Generate invite link based on user nickname or phone
  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/join?ref=${encodeURIComponent(nickname || userPhone)}`
    : `https://loci.app/join?ref=${encodeURIComponent(nickname || userPhone)}`;

  const shareText = `Hey! Join me on Loci so we can watch over each other when walking home safely. 🛡️🚀`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join Loci Safety Network",
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
      {/* Page Title */}
      <div>
        <h2 className="text-base font-black text-black dark:text-white flex items-center space-x-1.5">
          <span>Invite Guardians & Friends</span>
          <span>🚀</span>
        </h2>
        <p className="text-[11px] text-zinc-400">
          Share your personal link so your squad can join Loci and protect each other.
        </p>
      </div>

      {/* Main Share Card */}
      <div className="bg-zinc-900 text-white rounded-[28px] p-6 shadow-xl space-y-5 relative overflow-hidden border border-zinc-800">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center space-x-1 text-[9px] font-black uppercase tracking-widest bg-yellow-400 text-black px-2.5 py-1 rounded-full">
            <Sparkles className="w-3 h-3 text-black" />
            <span>EXCLUSIVE INVITE</span>
          </span>
          <Shield className="w-5 h-5 text-yellow-400" />
        </div>

        <div>
          <h3 className="text-xl font-black leading-snug tracking-tight text-white">
            Expand Your Safety Net 🛡️
          </h3>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
            When your friends join Loci using your link, they are automatically added to your contact pool!
          </p>
        </div>

        {/* Link Input Box */}
        <div className="bg-black/60 border border-zinc-800 rounded-2xl p-2.5 flex items-center justify-between space-x-2">
          <span className="text-xs font-mono text-zinc-300 truncate pl-2 flex-1">
            {shareUrl}
          </span>
          <button
            onClick={handleCopyLink}
            className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-yellow-400 active:scale-90 transition-all shrink-0"
            title="Copy Link"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        {/* Native Share Action Pill */}
        <button
          onClick={handleNativeShare}
          className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-black py-4 rounded-full text-xs transition-all flex items-center justify-center space-x-2 active:scale-[0.97] shadow-lg shadow-yellow-400/20"
        >
          <Share2 className="w-4 h-4" />
          <span>SHARE INVITE LINK 🔥</span>
        </button>
      </div>

      {/* Quick Share Options */}
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
            <p className="text-[10px] text-zinc-400">Send to chat squad</p>
          </div>
        </a>

        <button
          onClick={handleCopyLink}
          className="bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-4 flex items-center space-x-3 text-black dark:text-white active:scale-95 transition-all shadow-sm"
        >
          <QrCode className="w-5 h-5 text-yellow-500 shrink-0" />
          <div className="text-left">
            <p className="text-xs font-extrabold">Copy Link</p>
            <p className="text-[10px] text-zinc-400">{copied ? "Copied! 🎉" : "Paste anywhere"}</p>
          </div>
        </button>
      </div>
    </div>
  );
}