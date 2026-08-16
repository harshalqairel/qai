"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenCheck,
  BriefcaseBusiness,
  CalendarDays,
  LayoutDashboard,
  CirclePlus,
  MoreHorizontal,
  ReceiptText,
  FileText,
  PanelsTopLeft,
  ChartNoAxesCombined,
  Settings,
  Users,
  X,
} from "lucide-react";
import { QaiLogo } from "@/components/brand/QaiLogo";
import AuthControls from "@/components/auth/AuthControls";

const NAV = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", Icon: CalendarDays },
  { href: "/bookings", label: "Bookings", Icon: BookOpenCheck },
  { href: "/customers", label: "Clients", Icon: Users },
  { href: "/services", label: "Services", Icon: BriefcaseBusiness },
  { href: "/expenses", label: "Expenses", Icon: ReceiptText },
  { href: "/invoices", label: "Invoices", Icon: FileText },
  { href: "/reports", label: "Reports", Icon: ChartNoAxesCombined },
  { href: "/qai-page", label: "Qai Page", Icon: PanelsTopLeft },
  { href: "/settings", label: "Settings", Icon: Settings },
];

const MOBILE_NAV = NAV.filter((item) => ["/dashboard", "/calendar", "/bookings"].includes(item.href));
const MOBILE_MORE = NAV.filter((item) => !["/dashboard", "/calendar", "/bookings"].includes(item.href));
const QUICK_ACTIONS = [
  { href: "/bookings?new=1", label: "New booking", Icon: BookOpenCheck },
  { href: "/customers?new=1", label: "New client", Icon: Users },
  { href: "/expenses?new=1", label: "New expense", Icon: ReceiptText },
  { href: "/invoices?new=1", label: "New invoice", Icon: FileText },
];

function Brand({ onClick }: { onClick?: () => void }) {
  return (
    <Link
      href="/dashboard"
      onClick={onClick}
      aria-label="Go to Dashboard"
      className="inline-flex min-h-10 w-full rounded-lg px-2 py-1 transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
    >
      <QaiLogo size="md" decorative />
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
  const [moreOpen, setMoreOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const sheetOpen = moreOpen || createOpen;

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
        <span className="text-xs font-semibold tracking-wide text-muted-foreground">Run. Delight. Grow.</span>
      </header>

      {sheetOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/35 lg:hidden"
          onClick={() => { setMoreOpen(false); setCreateOpen(false); }}
          aria-label="Close actions"
        />
      )}

      {createOpen && <MobileSheet title="Create" onClose={() => setCreateOpen(false)}><div className="grid grid-cols-2 gap-3">{QUICK_ACTIONS.map(({ href, label, Icon }) => <Link key={href} href={href} onClick={() => setCreateOpen(false)} className="flex min-h-24 flex-col justify-between rounded-2xl border border-border bg-card p-4 font-semibold shadow-sm transition-colors hover:bg-muted"><Icon className="size-5 text-primary" aria-hidden="true" /><span>{label}</span></Link>)}</div></MobileSheet>}

      {moreOpen && <MobileSheet title="More" onClose={() => setMoreOpen(false)}><nav className="grid grid-cols-2 gap-2" aria-label="More navigation">{MOBILE_MORE.map(({ href, label, Icon }) => { const active = pathname === href; return <Link key={href} href={href} onClick={() => setMoreOpen(false)} aria-current={active ? "page" : undefined} className={`flex min-h-14 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold ${active ? "bg-accent text-accent-foreground" : "bg-muted/45 text-foreground"}`}><Icon className="size-4.5" aria-hidden="true" />{label}</Link>; })}</nav><div className="mt-4 border-t border-border pt-4"><AuthControls /></div></MobileSheet>}

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-card/96 px-2 pb-[max(.45rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_24px_rgba(16,27,52,.08)] backdrop-blur-xl lg:hidden" aria-label="Mobile navigation">
        {MOBILE_NAV.slice(0, 2).map(({ href, label, Icon }) => <MobileNavLink key={href} href={href} label={label} active={pathname === href} Icon={Icon} />)}
        <button type="button" aria-label="Create new" aria-expanded={createOpen} onClick={() => { setMoreOpen(false); setCreateOpen((value) => !value); }} className="mx-auto -mt-4 flex size-14 items-center justify-center rounded-full border-4 border-[var(--app-background)] bg-primary text-primary-foreground shadow-lg"><CirclePlus className="size-6" aria-hidden="true" /></button>
        {MOBILE_NAV.slice(2).map(({ href, label, Icon }) => <MobileNavLink key={href} href={href} label={label} active={pathname === href} Icon={Icon} />)}
        <button type="button" aria-label="More navigation" aria-expanded={moreOpen} onClick={() => { setCreateOpen(false); setMoreOpen((value) => !value); }} className={`flex min-h-13 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold ${moreOpen || MOBILE_MORE.some((item) => item.href === pathname) ? "text-primary" : "text-muted-foreground"}`}><MoreHorizontal className="size-5" aria-hidden="true" /><span>More</span></button>
      </nav>

      <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-card p-5 lg:sticky lg:top-0 lg:flex">
        <div className="mb-8 px-2 pt-1">
          <Brand />
        </div>
        <NavLinks pathname={pathname} />
        <div className="mt-auto">
          <AuthControls />
        </div>
      </aside>
    </>
  );
}

function MobileNavLink({ href, label, active, Icon }: { href: string; label: string; active: boolean; Icon: typeof LayoutDashboard }) {
  return <Link href={href} aria-current={active ? "page" : undefined} className={`flex min-h-13 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold ${active ? "text-primary" : "text-muted-foreground"}`}><Icon className="size-5" aria-hidden="true" /><span>{label}</span></Link>;
}

function MobileSheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <section role="dialog" aria-modal="true" aria-label={title} className="fixed inset-x-0 bottom-0 z-50 max-h-[82dvh] overflow-y-auto rounded-t-[1.75rem] border border-border bg-card px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl lg:hidden"><div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border" /><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">{title}</h2><button type="button" onClick={onClose} aria-label={`Close ${title.toLowerCase()}`} className="flex size-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted"><X className="size-5" /></button></div>{children}</section>;
}
