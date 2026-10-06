import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "AeroSight AI — Drone-Powered Construction Intelligence", template: "%s · AeroSight AI" },
  description: "See Every Site. Track Every Progress. Build Smarter. Drone operations, mapping, inspections, progress tracking and reporting for construction.",
  applicationName: "AeroSight AI",
  appleWebApp: { title: "AeroSight AI", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { themeColor: "#0B0F14", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
