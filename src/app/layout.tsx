import type { Metadata, Viewport } from "next";
import "./globals.css";
import { cn } from "@/lib/utils";
import AppFrame from "@/components/system/AppFrame";
import { Toaster } from "@/components/ui/sonner";
import { AppearanceThemeProvider } from "@/features/appearance/AppearanceThemeProvider";

export const metadata: Metadata = {
  title: "Qai",
  description: "Run your business, delight your clients, and grow with one connected workspace.",
  applicationName: "Qai",
  manifest: "/manifest.webmanifest?v=20260816",
  openGraph: {
    title: "Qai — Run. Delight. Grow.",
    description: "Bookings, schedules, clients, invoices, payments, expenses, and reports in one clear workspace.",
    type: "website",
  },
  icons: {
    icon: [
      { url: "/icon.svg?v=20260816", type: "image/svg+xml" },
      { url: "/icons/qai-favicon-32.png?v=20260816", sizes: "32x32", type: "image/png" },
      { url: "/icons/qai-icon-192.png?v=20260816", sizes: "192x192", type: "image/png" },
    ],
    shortcut: [{ url: "/icon.svg?v=20260816", type: "image/svg+xml" }],
    apple: [{ url: "/icons/qai-apple-touch-180.png?v=20260816", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#7A3F64",
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
