import Container from "@/components/ui/Container";
import Link from "next/link";
import { QaiLogo } from "@/components/brand/QaiLogo";
import { buttonVariants } from "@/components/ui/button";
import { ArrowRight, CalendarDays, CircleDollarSign, UsersRound } from "lucide-react";
import { redirect } from "next/navigation";
import ValidationAccess from "@/components/validation/ValidationAccess";
import { isValidationModeEnabled } from "@/lib/supabase/config";
import { requireValidationSession } from "@/lib/validation/session";

export default async function Home({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  if (isValidationModeEnabled()) {
    let activeSession = false;
    try { await requireValidationSession(); activeSession = true; } catch { /* Show access for absent, expired, disabled, or revoked sessions. */ }
    if (activeSession) redirect("/dashboard");
    const { invite } = await searchParams;
    return <ValidationAccess invalidInvite={invite === "invalid"} />;
  }
  return (
    <main className="min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,var(--background)_0%,var(--accent)_100%)]">
      <Container className="flex min-h-screen items-center py-10 sm:py-16">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <section className="max-w-xl text-left">
            <QaiLogo size="lg" />
            <h1 className="mt-8 text-4xl font-bold leading-[1.08] tracking-tight text-foreground sm:text-5xl lg:text-6xl">Your business, organized.</h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg">Connect requests, bookings, schedules, invoices, payments, reminders, and reports in one workspace—without replacing the channels your customers already use.</p>
            <Link href="/dashboard" className={buttonVariants({ size: "lg", className: "mt-8 w-full sm:w-auto" })}>Go to dashboard <ArrowRight aria-hidden="true" /></Link>
          </section>

          <section className="relative min-w-0" aria-label="Qai dashboard preview">
            <div className="pointer-events-none absolute -inset-5 rounded-[2rem] bg-[var(--brand)]/5 blur-2xl" aria-hidden="true" />
            <div className="surface-card relative overflow-hidden p-3 shadow-xl sm:p-5">
              <div className="flex items-center justify-between border-b border-border px-2 pb-4">
                <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--brand)]">Business overview</p><p className="mt-1 text-lg font-bold">Good morning</p></div>
                <span className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium">August 2026</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <PreviewCard icon={CircleDollarSign} label="Income" value="Rp 9.150.000" accent="bg-teal-50 text-teal-700" />
                <PreviewCard icon={UsersRound} label="Unpaid" value="Rp 1.500.000" accent="bg-amber-50 text-amber-700" />
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs font-semibold text-muted-foreground">Income by category</p>
                  <div className="mx-auto mt-4 size-24 rounded-full bg-[conic-gradient(var(--category-mauve)_0_66%,var(--category-blue)_66%_88%,var(--category-other)_88%)] p-4"><div className="size-full rounded-full bg-card" /></div>
                  <div className="mt-4 space-y-2 text-xs"><PreviewLegend color="var(--category-mauve)" label="Wedding" value="66%" /><PreviewLegend color="var(--category-blue)" label="Makeup Class" value="22%" /><PreviewLegend color="var(--category-other)" label="Other" value="12%" /></div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center gap-2"><CalendarDays className="size-4 text-[var(--brand)]" aria-hidden="true" /><p className="text-xs font-semibold text-muted-foreground">Upcoming jobs</p></div>
                  <div className="mt-4 space-y-3"><PreviewJob name="Wedding Makeup" customer="Sarah · 12 Aug, 07:00" /><PreviewJob name="Studio Session" customer="Maya · 15 Aug, 10:00" /><PreviewJob name="Makeup Class" customer="Rina · 20 Aug, 13:00" /></div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </Container>
    </main>
  );
}

function PreviewCard({ icon: Icon, label, value, accent }: { icon: typeof CircleDollarSign; label: string; value: string; accent: string }) {
  return <div className="rounded-xl border border-border bg-card p-4"><span className={`flex size-8 items-center justify-center rounded-lg ${accent}`}><Icon className="size-4" aria-hidden="true" /></span><p className="mt-4 text-xs text-muted-foreground">{label}</p><p className="mt-1 text-base font-bold sm:text-lg">{value}</p></div>;
}

function PreviewLegend({ color, label, value }: { color: string; label: string; value: string }) {
  return <div className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ backgroundColor: color }} /><span className="min-w-0 flex-1 truncate">{label}</span><strong>{value}</strong></div>;
}

function PreviewJob({ name, customer }: { name: string; customer: string }) {
  return <div className="rounded-lg bg-muted p-3"><p className="text-sm font-semibold">{name}</p><p className="mt-1 text-xs text-muted-foreground">{customer}</p></div>;
}
