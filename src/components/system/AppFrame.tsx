"use client";

import { usePathname } from "next/navigation";

import Sidebar from "@/components/Sidebar";
import AppStartup from "@/components/system/AppStartup";

function usesApplicationChrome(pathname: string): boolean {
  if (pathname === "/" || pathname === "/login" || pathname === "/onboarding") {
    return false;
  }
  return !pathname.startsWith("/auth/");
}

export default function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (!usesApplicationChrome(pathname)) return children;

  return (
    <>
      <Sidebar />
      <div className="app-canvas min-w-0 flex-1 pt-14 lg:pt-0">
        <AppStartup>{children}</AppStartup>
      </div>
    </>
  );
}
