import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-black text-zinc-900 dark:text-zinc-100 flex flex-col justify-between font-sans antialiased selection:bg-yellow-400 selection:text-black">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-200 dark:border-zinc-800/80 bg-white/80 dark:bg-black/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <img src="/loci-light.png" alt="Déloci Logo" className="h-10 w-auto object-contain shrink-0 dark:hidden" />
            <img src="/loci-dark.png" alt="Déloci Logo" className="hidden h-10 w-auto object-contain shrink-0 dark:block" />
          </Link>
          <Link
            href="/"
            className="text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </Link>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="max-w-6xl mx-auto px-6 py-10 sm:py-16 space-y-8 flex-1 w-full">
        
        {/* Featured Big Card (Top) */}
        <div className="rounded-[36px] border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/40 p-8 sm:p-12 space-y-6 transition-all">
          <div className="text-3xl sm:text-4xl">🚀</div>
          
          <div className="space-y-3">
            <span className="inline-block text-[10px] font-black uppercase tracking-widest bg-yellow-400/20 text-yellow-700 dark:text-yellow-400 border border-yellow-400/30 px-3.5 py-1 rounded-full">
              OUR MISSION
            </span>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-black dark:text-white tracking-tight lowercase">
              consent-first safety check-ins for everyday peace of mind
            </h1>
            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-3xl lowercase">
              déloci was created to give you full control over how and when your journey is shared. no permanent tracking, no invasive background spying—just deliberate, timed watch sessions that automatically alert your trusted circle when you don't check in.
            </p>
          </div>

          <div className="text-xs text-zinc-400 font-mono pt-2">
            déloci team · october 2026
          </div>
        </div>

        {/* 3-Column Card Grid (Bottom) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1 */}
          <div className="rounded-4xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/40 p-8 space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="text-3xl">🛡️</div>
              <span className="inline-block text-[10px] font-black uppercase tracking-widest bg-yellow-400/20 text-yellow-700 dark:text-yellow-400 border border-yellow-400/30 px-3 py-1 rounded-full">
                ACTIVE PRIVACY
              </span>
              <h2 className="text-lg font-extrabold text-black dark:text-white tracking-tight lowercase">
                active watch sessions only
              </h2>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed lowercase">
                location is shared strictly when a timer is live. once you check in safely, tracking turns off immediately.
              </p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="rounded-4xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/40 p-8 space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="text-3xl">⚡</div>
              <span className="inline-block text-[10px] font-black uppercase tracking-widest bg-yellow-400/20 text-yellow-700 dark:text-yellow-400 border border-yellow-400/30 px-3 py-1 rounded-full">
                AUTOMATION
              </span>
              <h2 className="text-lg font-extrabold text-black dark:text-white tracking-tight lowercase">
                high-priority web push
              </h2>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed lowercase">
                if time runs out, high-priority push notifications bypass background queues to reach your guardians instantly.
              </p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="rounded-4xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/40 p-8 space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="text-3xl">🌐</div>
              <span className="inline-block text-[10px] font-black uppercase tracking-widest bg-yellow-400/20 text-yellow-700 dark:text-yellow-400 border border-yellow-400/30 px-3 py-1 rounded-full">
                OFFLINE SYNC
              </span>
              <h2 className="text-lg font-extrabold text-black dark:text-white tracking-tight lowercase">
                indexeddb local cache
              </h2>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed lowercase">
                spotty cellular signal won't break your safety net. check-ins queue locally and sync automatically upon reconnection.
              </p>
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-900 py-8 px-6 bg-zinc-50/50 dark:bg-zinc-950/50">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500 dark:text-zinc-400">
          <p>© {new Date().getFullYear()} Déloci. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-black dark:hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-black dark:hover:text-white transition-colors">Terms of Service</Link>
            <Link href="/contact" className="hover:text-black dark:hover:text-white transition-colors">Contact Support</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}