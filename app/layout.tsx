import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
