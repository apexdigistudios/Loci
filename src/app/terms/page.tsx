import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function TermsPage() {
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

      {/* Main Document Content */}
      <main className="max-w-3xl mx-auto px-6 py-12 sm:py-20 space-y-8 flex-1 w-full">
        {/* Document Title & Subhead */}
        <div className="space-y-3">
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-black dark:text-white">
            Terms of Service
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 font-mono">
            Version 1.0 · Last Updated: October 8, 2026 · Effective Date: October 8, 2026
          </p>
        </div>

        <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed border-b border-zinc-200 dark:border-zinc-800 pb-8">
          These terms govern your access to and use of Déloci. Questions regarding this document can be directed to{" "}
          <a href="mailto:support@deloci.online" className="text-yellow-600 dark:text-yellow-400 font-medium underline">
            support@deloci.online
          </a>.
        </p>

        {/* Numbered Legal Sections */}
        <div className="space-y-10 text-sm sm:text-base text-zinc-600 dark:text-zinc-300 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-black text-black dark:text-white">
              1. Introduction
            </h2>
            <p>
              Welcome to Déloci. Déloci provides a consent-based personal safety check-in application that allows users to share active watch sessions and automated arrival alerts with their trusted circle.
            </p>
            <p>
              By accessing or using Déloci, you acknowledge that you have read, understood, and agreed to be bound by these Terms of Service. If you do not agree to these terms, you must discontinue using the application.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-black text-black dark:text-white">
              2. Emergency Services Disclaimer
            </h2>
            <p>
              Déloci is a peer-to-peer safety check-in and alert tool. <strong>Déloci is not an emergency response service and is not a replacement for contacting local law enforcement or emergency responders (e.g., 911, 112, or 999).</strong>
            </p>
            <p>
              In active danger or life-threatening situations, always contact your local emergency response authorities directly. Déloci does not guarantee that your emergency contacts will view or react to automated notifications in real-time.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-black text-black dark:text-white">
              3. User Conduct & Responsible Use
            </h2>
            <p>
              You agree to provide accurate guardian contact details and to use Déloci strictly for lawful personal safety check-ins. Misuse of the alert system to trigger false emergencies, send spam, or harass contacts is strictly prohibited and may result in account termination.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-black text-black dark:text-white">
              4. Network & Device Limitations
            </h2>
            <p>
              Push notifications, GPS coordinates, and offline queue synchronization rely on third-party mobile web push networks, cellular data, satellite visibility, and local battery optimization settings on your device. Déloci is not liable for delayed notifications caused by hardware, network, or OS background restrictions.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-black text-black dark:text-white">
              5. Account Termination
            </h2>
            <p>
              You may stop using Déloci or delete your session logs at any time. We reserve the right to suspend or restrict accounts that violate these Terms of Service without prior notice.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-900 py-8 px-6 bg-zinc-50/50 dark:bg-zinc-950/50">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500 dark:text-zinc-400">
          <p>© {new Date().getFullYear()} Déloci. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/about" className="hover:text-black dark:hover:text-white transition-colors">About</Link>
            <Link href="/privacy" className="hover:text-black dark:hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/contact" className="hover:text-black dark:hover:text-white transition-colors">Contact Support</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}