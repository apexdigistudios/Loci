"use client";

import React from "react";
import Link from "next/link";
import { ChevronLeft, ShieldCheck, ArrowLeft, RefreshCw, FileText, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

export default function RefundPolicyPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white dark:bg-black text-zinc-900 dark:text-zinc-100 flex flex-col justify-between font-sans antialiased selection:bg-yellow-400 selection:text-black">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-200 dark:border-zinc-800/80 bg-white/80 dark:bg-black/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="p-2.5 rounded-full bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-black dark:text-white active:scale-90 transition-all border border-zinc-300/50 dark:border-zinc-800 flex items-center space-x-1.5 pr-4 shadow-xs"
            >
              <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
              <span className="text-xs font-bold">Back</span>
            </button>
            <Link href="/" className="hidden sm:flex items-center space-x-2 ml-2">
              <img src="/loci-light.png" alt="Déloci Logo" className="h-8 w-auto object-contain dark:hidden" />
              <img src="/loci-dark.png" alt="Déloci Logo" className="hidden h-8 w-auto object-contain dark:block" />
            </Link>
          </div>

          <span className="text-xs font-mono font-bold uppercase text-zinc-400 tracking-wider">
            Legal &amp; Compliance
          </span>

          <div className="flex items-center space-x-3">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 md:px-8 py-8 sm:py-12 space-y-8">
        {/* Hero Section */}
        <div className="bg-zinc-100/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-10 backdrop-blur-xl space-y-3">
          <div className="inline-flex items-center gap-2 bg-yellow-400/20 text-yellow-700 dark:text-yellow-400 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border border-yellow-400/30">
            <ShieldCheck className="w-4 h-4 text-yellow-500" />
            <span>Buyer Protection</span>
          </div>
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-black dark:text-white tracking-tight">
            Refund &amp; Cancellation Policy
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 font-medium max-w-2xl">
            At Déloci, we prioritize transparent and simple billing terms. Below are the conditions governing subscription payments, renewals, and refunds.
          </p>
          <p className="text-[11px] font-mono text-zinc-400 pt-2">
            Last updated: October 2026
          </p>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="bg-white dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 p-6 rounded-3xl space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-2xl bg-yellow-400 text-black flex items-center justify-center font-bold shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <h2 className="text-base font-extrabold text-black dark:text-white">1. Subscription Terms</h2>
            <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              Déloci operates on a prepaid subscription model for Pro tier safety features. Subscriptions automatically renew at the end of each billing cycle (monthly or annually) unless canceled prior to your scheduled renewal date.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-white dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 p-6 rounded-3xl space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-2xl bg-yellow-400 text-black flex items-center justify-center font-bold shadow-xs">
              <RefreshCw className="w-5 h-5" />
            </div>
            <h2 className="text-base font-extrabold text-black dark:text-white">2. 7-Day Money-Back Guarantee</h2>
            <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              If you are unsatisfied with your initial Pro subscription purchase, you are eligible for a full refund within <strong>7 days</strong> of your first transaction. Simply reach out to support with your account information.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-white dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 p-6 rounded-3xl space-y-3 shadow-xs md:col-span-2 lg:col-span-1">
            <div className="w-10 h-10 rounded-2xl bg-yellow-400 text-black flex items-center justify-center font-bold shadow-xs">
              <Mail className="w-5 h-5" />
            </div>
            <h2 className="text-base font-extrabold text-black dark:text-white">3. Renewals &amp; Support</h2>
            <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              You can cancel your subscription at any time via your account settings. Upon cancellation, access remains active until the end of your billing cycle. For questions or refund requests, contact our support team.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-900 py-8 px-6 bg-zinc-50/50 dark:bg-zinc-950/50">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            © {new Date().getFullYear()} Déloci. All rights reserved.
          </p>
          <div className="flex items-center space-x-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            <Link href="/privacy" className="hover:text-black dark:hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-black dark:hover:text-white transition-colors">Terms</Link>
            <Link href="/contact" className="hover:text-black dark:hover:text-white transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}