import type { Metadata, Viewport } from "next";
import "./globals.css";
import { cn } from "@/lib/utils";
import AppFrame from "@/components/system/AppFrame";
import { Toaster } from "@/components/ui/sonner";
import { AppearanceThemeProvider } from "@/features/appearance/AppearanceThemeProvider";

export const metadata: Metadata = {
  title: "Qai",
  description: "Manage bookings, clients, income, expenses, and reminders in one place.",
  applicationName: "Qai",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/qai-icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/qai-icon-512.png", sizes: "512x512", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0D5C5A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", "font-sans")}
    >
      <body className="flex min-h-full bg-background">
        <AppearanceThemeProvider>
          <AppFrame>{children}</AppFrame>
          <Toaster position="top-right" closeButton />
        </AppearanceThemeProvider>
      </body>
    </html>
  );
}
