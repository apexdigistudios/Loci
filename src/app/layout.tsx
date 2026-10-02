import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "../components/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Déloci | Consent-Based Safety Check-In",
  description: "Share your journey safely with trusted contacts.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192.png",
    shortcut: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Déloci — Consent-Based Safety Check-Ins",
    description: "Keep the people you trust aware of where you are.",
    url: "https://deloci.online",
    siteName: "Déloci",
    images: [
      {
        url: "https://deloci.online/icon-512.png",
        width: 512,
        height: 512,
        alt: "Déloci Logo",
      },
    ],
  },
  verification: {
    google: "YOUR_GOOGLE_SEARCH_CONSOLE_CODE_HERE",
    other: {
      "msvalidate.01": "BING_VERIFICATION_CODE_HERE",
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#FACC15",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#FACC15" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Déloci",
              url: "https://deloci.online",
              logo: "https://deloci.online/icon-512.png",
            }),
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-white dark:bg-[#0c0c0e] text-slate-900 dark:text-slate-100 transition-colors duration-200">
        <ThemeProvider attribute="class" defaultTheme="system" disableTransitionOnChange enableSystem>
          {children}
        </ThemeProvider>
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-GCDQ3CV7MY" strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-GCDQ3CV7MY');
          `}
        </Script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js');
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}