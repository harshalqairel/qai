import type { Metadata } from "next";
import "./globals.css";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Qai Business OS",
  description: "A simple business workspace for independent service professionals.",
};

import Sidebar from "@/components/Sidebar";

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
          {children}
        </div>
      </body>
    </html>
  );
}
