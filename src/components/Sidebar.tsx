"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/bookings", label: "Bookings" },
  { href: "/calendar", label: "Calendar" },
  { href: "/customers", label: "Customers" },
  { href: "/services", label: "Services" },
  { href: "/expenses", label: "Expenses" },
  { href: "/settings", label: "Settings" },
];

function NavLinks({ pathname, onClick }: { pathname: string; onClick?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((n) => {
        const active = pathname === n.href;
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={onClick}
            className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              active ? "bg-slate-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      {/* ── Mobile top bar ─────────────────────────────────────── */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-4 lg:hidden">
        <div className="text-lg font-bold text-slate-900">Qai</div>
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setDrawerOpen(true)}
          className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100"
        >
          {/* Hamburger icon */}
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 5h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2z" clipRule="evenodd" />
          </svg>
        </button>
      </header>

      {/* ── Mobile drawer overlay ──────────────────────────────── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile drawer panel ────────────────────────────────── */}
      <div
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-white shadow-xl transition-transform duration-300 lg:hidden ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 items-center justify-between border-b border-zinc-200 px-4">
          <div>
            <div className="text-lg font-bold text-slate-900">Qai</div>
            <div className="text-[11px] text-zinc-500">Manage bookings</div>
          </div>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <NavLinks pathname={pathname} onClick={() => setDrawerOpen(false)} />
        </div>
        <div className="border-t border-zinc-100 p-4 text-xs text-zinc-400">v0.1 • MVP</div>
      </div>

      {/* ── Desktop sidebar ────────────────────────────────────── */}
      <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-zinc-200 bg-white p-6 lg:flex">
        <div className="mb-8">
          <div className="text-2xl font-bold text-slate-900">Qai</div>
          <div className="mt-0.5 text-xs text-zinc-500">Manage bookings and services</div>
        </div>
        <NavLinks pathname={pathname} />
        <div className="mt-auto pt-6 text-xs text-zinc-400">v0.1 • MVP</div>
      </aside>
    </>
  );
}

