import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SessionProvider } from "@/components/providers/session-provider";
import { ToastProvider } from "@/components/ui/toast";
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
  title: "Sparkles Overwatch | CS2 Demo Review Portal",
  description: "Submit CS2 demos for community review. Help identify cheaters and keep the game fair.",
  keywords: ["CS2", "Counter-Strike 2", "demo review", "cheater detection", "overwatch", "anti-cheat"],
  authors: [{ name: "Sparkles" }],
  openGraph: {
    title: "Sparkles Overwatch",
    description: "Submit CS2 demos for community review. Help identify cheaters and keep the game fair.",
    type: "website",
    siteName: "Sparkles Overwatch",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sparkles Overwatch",
    description: "Submit CS2 demos for community review",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-950 text-gray-100 min-h-screen`}
      >
        <SessionProvider>
          <ToastProvider>{children}</ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
