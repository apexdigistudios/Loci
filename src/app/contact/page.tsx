import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function ContactPage() {
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
            Contact Support
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 font-mono">
            Direct Assistance · Account Support · Security Inquiries
          </p>
        </div>

        <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed border-b border-zinc-200 dark:border-zinc-800 pb-8">
          Have questions about watch sessions, background notification permissions, or account settings? Get in touch with our team directly at{" "}
          <a href="mailto:support@deloci.online" className="text-yellow-600 dark:text-yellow-400 font-medium underline">
            support@deloci.online
          </a>.
        </p>

        {/* Numbered Contact Sections */}
        <div className="space-y-10 text-sm sm:text-base text-zinc-600 dark:text-zinc-300 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-black text-black dark:text-white">
              1. General Inquiries & Feedback
            </h2>
            <p>
              For general questions regarding the Déloci platform, feature suggestions, or user feedback, reach out to us via email at <strong>support@deloci.online</strong>. We review all user communications to continuously refine our safety experience.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-black text-black dark:text-white">
              2. Technical & Push Notification Support
            </h2>
            <p>
              If your guardians are not receiving web push alerts or you are experiencing issues with location updates:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-zinc-600 dark:text-zinc-400">
              <li>Ensure browser notification permissions are explicitly set to <strong>Allowed</strong>.</li>
              <li>Verify that background battery optimization for your browser or PWA is set to <strong>Unrestricted</strong>.</li>
              <li>Include your phone model, operating system version, and browser type when emailing support.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-black text-black dark:text-white">
              3. Data Privacy & Account Requests
            </h2>
            <p>
              To request account data removal, session history purges, or inquiries regarding our Row-Level Security storage, send an email with the subject line <strong>Data Privacy Request</strong> to support@deloci.online.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-black text-black dark:text-white">
              4. Response Times
            </h2>
            <p>
              Our support team handles requests directly. Standard response times range between 24 to 48 hours on business days.
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
            <Link href="/terms" className="hover:text-black dark:hover:text-white transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}