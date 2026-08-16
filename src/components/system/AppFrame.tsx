"use client";

import { usePathname } from "next/navigation";

import Sidebar from "@/components/Sidebar";
import AppStartup from "@/components/system/AppStartup";

function usesApplicationChrome(pathname: string): boolean {
  if (pathname === "/" || pathname === "/login" || pathname === "/onboarding") {
    return false;
  }
  if (pathname.startsWith("/q/")) return false;
  if (pathname.startsWith("/test/") || pathname.startsWith("/validation/founder")) return false;
  return !pathname.startsWith("/auth/");
}

export default function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (!usesApplicationChrome(pathname)) return children;

  return (
    <>
      <Sidebar />
      <div className="app-canvas min-w-0 flex-1 pb-[calc(4.75rem+env(safe-area-inset-bottom))] pt-14 lg:pb-0 lg:pt-0">
        <AppStartup>{children}</AppStartup>
      </div>
    </>
  );
}
