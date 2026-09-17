import type { Metadata } from "next";
import { Archivo, Geist_Mono } from "next/font/google";
import "./globals.css";

// Design system typeface (Swiss-modernist editorial direction) - one family
// only, loaded as its variable axis so every weight from 400 (body) through
// 600/700 (display/section headings) comes from the same font file. See
// globals.css's .display-heading/.section-heading/.body-copy/.label-text
// for how weight (not a second typeface) creates the contrast.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "MetaWorld Research Academy",
    template: "%s — MetaWorld Research Academy",
  },
  description: "We mentor systematic reviewers and meta-analysts from a vague question to a peer-reviewed paper, backed by a Cochrane-aligned statistical toolkit.",
  openGraph: {
    title: "MetaWorld Research Academy",
    description: "Rigorous training. Real publications. Independent researchers.",
    siteName: "MetaWorld Research Academy",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "MetaWorld Research Academy",
    description: "Rigorous training. Real publications. Independent researchers.",
  },
  // Enables "Add to Home Screen" on both Android (via manifest.ts) and iOS
  // Safari (iOS ignores the web manifest for its home-screen icon/title, so
  // these apple-specific tags are what actually control it there).
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MetaWorld",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport = { themeColor: "#000000" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
