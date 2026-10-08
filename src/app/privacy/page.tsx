import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
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
            Privacy Policy
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 font-mono">
            Version 1.0 · Last Updated: October 8, 2026 · Effective Date: October 8, 2026
          </p>
        </div>

        <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed border-b border-zinc-200 dark:border-zinc-800 pb-8">
          This Privacy Policy explains how Déloci collects, uses, and safeguards your data. For privacy inquiries, email{" "}
          <a href="mailto:support@deloci.online" className="text-yellow-600 dark:text-yellow-400 font-medium underline">
            support@deloci.online
          </a>.
        </p>

        {/* Numbered Privacy Sections */}
        <div className="space-y-10 text-sm sm:text-base text-zinc-600 dark:text-zinc-300 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-black text-black dark:text-white">
              1. Information We Collect
            </h2>
            <p>
              We collect minimal personal data required to deliver safety check-ins and dispatch alerts to your designated contacts:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-zinc-600 dark:text-zinc-400">
              <li><strong>Account Identifiers:</strong> Your phone number used for login authentication.</li>
              <li><strong>Active Location Data:</strong> Geolocation coordinates recorded exclusively during an active safety session.</li>
              <li><strong>Trusted Circle Contacts:</strong> Names and phone numbers of guardians you explicitly add.</li>
              <li><strong>Push Notification Tokens:</strong> Cryptographic subscription endpoints to route web push alerts.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-black text-black dark:text-white">
              2. How Location Data Is Handled
            </h2>
            <p>
              Déloci does <strong>not</strong> passively track your location in the background when no session is running. GPS location is accessed only when you start an active watch session, perform a safety check-in, or when a session timer expires without check-in.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-black text-black dark:text-white">
              3. Data Sharing & Third Parties
            </h2>
            <p>
              We do not sell, rent, or share your personal information or location history with advertisers or third-party marketers. Your session details are shared strictly with the contacts you select for that specific session.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-black text-black dark:text-white">
              4. Security & Storage
            </h2>
            <p>
              Database requests are protected with encrypted SSL communication and enforced by Supabase Row-Level Security (RLS) policies. Session history is accessible only via your authenticated phone number.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-black text-black dark:text-white">
              5. Your Rights & Data Deletion
            </h2>
            <p>
              You can view, edit, or clear your trusted contacts and past session logs directly within the application dashboard at any time. To request full deletion of your account record, contact us at support@deloci.online.
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
            <Link href="/terms" className="hover:text-black dark:hover:text-white transition-colors">Terms of Service</Link>
            <Link href="/contact" className="hover:text-black dark:hover:text-white transition-colors">Contact Support</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}