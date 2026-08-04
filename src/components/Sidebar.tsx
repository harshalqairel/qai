"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenCheck,
  BriefcaseBusiness,
  CalendarDays,
  LayoutDashboard,
  Menu,
  ReceiptText,
  Settings,
  Users,
  X,
} from "lucide-react";
import { QaiLogo } from "@/components/brand/QaiLogo";

const NAV = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/bookings", label: "Bookings", Icon: BookOpenCheck },
  { href: "/calendar", label: "Calendar", Icon: CalendarDays },
  { href: "/customers", label: "Customers", Icon: Users },
  { href: "/services", label: "Services", Icon: BriefcaseBusiness },
  { href: "/expenses", label: "Expenses", Icon: ReceiptText },
  { href: "/settings", label: "Settings", Icon: Settings },
];

function Brand({ onClick }: { onClick?: () => void }) {
  return (
    <Link
      href="/dashboard"
      onClick={onClick}
      aria-label="Go to Dashboard"
      className="inline-flex min-h-10 w-full rounded-lg px-2 py-1 transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
    >
      <span>
        <QaiLogo size="md" decorative />
        <span className="mt-1 block text-xs text-muted-foreground">Creative business manager</span>
      </span>
    </Link>
  );
}

function NavLinks({ pathname, onClick }: { pathname: string; onClick?: () => void }) {
  return (
    <nav className="flex flex-col gap-1.5" aria-label="Main navigation">
      {NAV.map(({ href, label, Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={onClick}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 items-center gap-3 rounded-r-xl border-l-4 px-3 py-2.5 text-sm font-semibold transition-colors ${
              active
                ? "border-l-[var(--brand)] bg-accent text-accent-foreground"
                : "border-l-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Icon className="size-4.5 shrink-0" aria-hidden="true" />
            <span>{label}</span>
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
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur lg:hidden">
        <Link
          href="/dashboard"
          aria-label="Go to Dashboard"
          className="inline-flex min-h-10 items-center rounded-lg px-2 py-1 transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        >
          <QaiLogo size="sm" decorative />
        </Link>
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setDrawerOpen(true)}
          className="flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
      </header>

      {drawerOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/35 lg:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-label="Close menu"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-card shadow-xl transition-transform duration-200 lg:hidden ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-5">
          <Brand onClick={() => setDrawerOpen(false)} />
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            className="flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <NavLinks pathname={pathname} onClick={() => setDrawerOpen(false)} />
        </div>
        <div className="border-t border-border p-4 text-xs text-muted-foreground">Qai Business OS</div>
      </aside>

      <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-card p-5 lg:sticky lg:top-0 lg:flex">
        <div className="mb-8 px-2 pt-1">
          <Brand />
        </div>
        <NavLinks pathname={pathname} />
        <div className="mt-auto border-t border-border px-2 pt-5 text-xs text-muted-foreground">Qai Business OS</div>
      </aside>
    </>
  );
}
