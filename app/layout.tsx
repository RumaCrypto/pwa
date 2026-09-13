import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { AppProvidersClient } from "@/providers/app-providers-client";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ruma",
  description: "Buy and sell USDC with your local currency.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Ruma",
  },
  // Icons come from app/icon.svg and app/apple-icon.png via Next's file
  // convention, which emits the link tags itself.
};

// Privy's SDK touches browser-only globals during its client render; every
// route sits under AppProviders (PrivyProvider), so static prerendering of
// any page fails at build time without opting the whole tree out of it.
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: "#0057ff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-text">
        <AppProvidersClient>
          <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background">
            {children}
          </div>
        </AppProvidersClient>
      </body>
    </html>
  );
}
