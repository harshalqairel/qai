"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BookOpenCheck,
  BriefcaseBusiness,
  CalendarDays,
  CirclePlus,
  CircleHelp,
  ChevronRight,
  LayoutDashboard,
  MoreHorizontal,
  ReceiptText,
  FileText,
  PanelsTopLeft,
  ChartNoAxesCombined,
  Settings,
  Settings2,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { QaiLogo } from "@/components/brand/QaiLogo";
import AuthControls from "@/components/auth/AuthControls";
import useOperationalAttention from "@/features/dashboard/hooks/useOperationalAttention";
import { formatRupiah } from "@/features/payment/utils/paymentCalculations";

type NavItem = { href: string; label: string; Icon: LucideIcon };

const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  { label: "Work", items: [
    { href: "/dashboard", label: "Home", Icon: LayoutDashboard },
    { href: "/calendar", label: "Calendar", Icon: CalendarDays },
    { href: "/bookings", label: "Bookings", Icon: BookOpenCheck },
    { href: "/customers", label: "Clients", Icon: Users },
  ] },
  { label: "Business", items: [
    { href: "/services", label: "Services", Icon: BriefcaseBusiness },
    { href: "/expenses", label: "Expenses", Icon: ReceiptText },
    { href: "/invoices", label: "Invoices", Icon: FileText },
    { href: "/reports", label: "Reports", Icon: ChartNoAxesCombined },
  ] },
  { label: "Presence", items: [
    { href: "/qai-page", label: "Qai Page", Icon: PanelsTopLeft },
  ] },
  { label: "System", items: [
    { href: "/settings", label: "Settings", Icon: Settings },
  ] },
];

const NAV = NAV_GROUPS.flatMap((group) => group.items);
const MOBILE_PRIMARY_PATHS = ["/dashboard", "/bookings", "/calendar", "/customers"];
const MOBILE_NAV = MOBILE_PRIMARY_PATHS.map((href) => NAV.find((item) => item.href === href)!);
const MOBILE_MORE = [
  ...NAV.filter((item) => !MOBILE_PRIMARY_PATHS.includes(item.href)),
  { href: "/settings?section=how-to-use", label: "Qai Guide", Icon: CircleHelp },
];
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
    <nav className="flex flex-col gap-5" aria-label="Main navigation">
      {NAV_GROUPS.map((group) => <div key={group.label}>
        <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/75">{group.label}</p>
        <div className="space-y-0.5">{group.items.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return <Link key={href} href={href} onClick={onClick} aria-current={active ? "page" : undefined} className={`flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}><Icon className="size-4.5 shrink-0" aria-hidden="true" /><span>{label}</span></Link>;
        })}</div>
      </div>)}
    </nav>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [attentionOpen, setAttentionOpen] = useState(false);
  const attention = useOperationalAttention();
  const sheetOpen = menuOpen || createOpen || attentionOpen;

  function closeSheets() {
    setMenuOpen(false);
    setCreateOpen(false);
    setAttentionOpen(false);
  }

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-border/80 bg-card/95 px-3.5 backdrop-blur-xl lg:hidden">
        <Link
          href="/dashboard"
          aria-label="Go to Dashboard"
          className="inline-flex min-h-10 items-center rounded-lg px-2 py-1 transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        >
          <QaiLogo size="sm" decorative />
        </Link>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={attention.attentionCount > 0 ? `${attention.attentionCount} items need attention` : "No items need attention"}
            aria-expanded={attentionOpen}
            onClick={() => { setMenuOpen(false); setCreateOpen(false); setAttentionOpen((value) => !value); }}
            className="relative flex size-11 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Bell className="size-5" aria-hidden="true" />
            {attention.attentionCount > 0 && <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-4 text-primary-foreground">{Math.min(attention.attentionCount, 99)}</span>}
          </button>
          <button
            type="button"
            aria-label="Open app menu"
            aria-expanded={menuOpen}
            onClick={() => { setAttentionOpen(false); setCreateOpen(false); setMenuOpen((value) => !value); }}
            className="flex size-11 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <MoreHorizontal className="size-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      {sheetOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/35 lg:hidden"
          onClick={closeSheets}
          aria-label="Close actions"
        />
      )}

      {createOpen && <MobileSheet title="Create" onClose={() => setCreateOpen(false)}><div className="grid grid-cols-2 gap-3">{QUICK_ACTIONS.map(({ href, label, Icon }) => <Link key={href} href={href} onClick={() => setCreateOpen(false)} className="flex min-h-24 flex-col justify-between rounded-xl border border-border bg-card p-4 font-semibold transition-colors hover:border-primary/35 hover:bg-muted"><Icon className="size-5 text-primary" aria-hidden="true" /><span>{label}</span></Link>)}</div></MobileSheet>}

      {attentionOpen && <MobileSheet title="Needs attention" onClose={() => setAttentionOpen(false)}><AttentionPanel attention={attention} onNavigate={() => setAttentionOpen(false)} /></MobileSheet>}

      {menuOpen && <MobileSheet title="Menu" onClose={() => setMenuOpen(false)}>{pathname === "/dashboard" && <button type="button" onClick={() => { setMenuOpen(false); window.dispatchEvent(new Event("qai:customize-dashboard")); }} className="mb-4 flex min-h-12 w-full items-center gap-3 rounded-xl border border-border px-3 text-left text-sm font-semibold hover:bg-muted"><Settings2 className="size-4.5 text-primary" aria-hidden="true" />Customize dashboard</button>}<nav className="grid grid-cols-2 gap-2" aria-label="Secondary navigation">{MOBILE_MORE.map(({ href, label, Icon }) => { const active = pathname === href; return <Link key={href} href={href} onClick={() => setMenuOpen(false)} aria-current={active ? "page" : undefined} className={`flex min-h-14 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold ${active ? "bg-accent text-accent-foreground" : "bg-muted/45 text-foreground"}`}><Icon className="size-4.5" aria-hidden="true" />{label}</Link>; })}</nav><div className="mt-4 border-t border-border pt-4"><AuthControls /></div></MobileSheet>}

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border/80 bg-card/96 px-1.5 pb-[max(.4rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_24px_rgba(16,27,52,.07)] backdrop-blur-xl lg:hidden" aria-label="Mobile navigation">
        {MOBILE_NAV.slice(0, 2).map(({ href, label, Icon }) => <MobileNavLink key={href} href={href} label={label} active={pathname === href} Icon={Icon} />)}
        <button type="button" aria-label="Create new" aria-expanded={createOpen} onClick={() => { setMenuOpen(false); setAttentionOpen(false); setCreateOpen((value) => !value); }} className="absolute left-[50vw] top-[-.75rem] flex size-13 -translate-x-1/2 items-center justify-center rounded-2xl border-[3px] border-[var(--app-background)] bg-primary text-primary-foreground shadow-[0_8px_20px_rgba(86,51,79,.24)]"><CirclePlus className="size-6" aria-hidden="true" /></button>
        <span aria-hidden="true" />
        {MOBILE_NAV.slice(2).map(({ href, label, Icon }) => <MobileNavLink key={href} href={href} label={label} active={pathname === href} Icon={Icon} />)}
      </nav>

      <aside className="hidden h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-border bg-card p-4 lg:sticky lg:top-0 lg:flex">
        <div className="mb-6 px-2 pt-1">
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

function AttentionPanel({ attention, onNavigate }: { attention: ReturnType<typeof useOperationalAttention>; onNavigate: () => void }) {
  if (attention.attentionCount === 0) return <div className="border-y border-border py-5"><p className="font-semibold">You’re up to date.</p><p className="mt-1 text-sm text-muted-foreground">No overdue payments or booking requests need action.</p></div>;
  return <div className="divide-y divide-border border-y border-border">
    {attention.overdueCount > 0 && <Link href="/bookings?payment=outstanding" onClick={onNavigate} className="flex min-h-18 items-center gap-3 py-3"><span className="min-w-0 flex-1"><span className="block font-semibold">Overdue payments</span><span className="mt-1 block text-sm text-muted-foreground">{attention.overdueCount} {attention.overdueCount === 1 ? "booking" : "bookings"} · {formatRupiah(attention.overdueAmount)}</span></span><ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" /></Link>}
    {attention.requestCount > 0 && <Link href="/qai-page?tab=Requests" onClick={onNavigate} className="flex min-h-18 items-center gap-3 py-3"><span className="min-w-0 flex-1"><span className="block font-semibold">Booking requests</span><span className="mt-1 block text-sm text-muted-foreground">{attention.requestCount} waiting</span></span><ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" /></Link>}
  </div>;
}
