import type { Metadata } from "next";
import "./globals.css";
import { cn } from "@/lib/utils";
import AppStartup from "@/components/system/AppStartup";
import { Toaster } from "@/components/ui/sonner";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Qai",
  description: "A simple business tool for bookings, customers, payments, and expenses.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
  },
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
        <Sidebar />
        <div className="app-canvas min-w-0 flex-1 pt-14 lg:pt-0">
          <AppStartup>{children}</AppStartup>
        </div>
        <Toaster position="top-right" closeButton />
      </body>
    </html>
  );
}
