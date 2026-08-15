import Container from "@/components/ui/Container";
import Link from "next/link";
import { QaiLogo } from "@/components/brand/QaiLogo";
import { buttonVariants } from "@/components/ui/button";
import { ArrowRight, BarChart3, CalendarDays, CheckCircle2, CircleDollarSign, FileText, UsersRound, WalletCards } from "lucide-react";
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
    <main className="min-h-screen overflow-x-hidden bg-background">
      <header className="border-b border-border bg-white/90 backdrop-blur">
        <Container className="flex h-18 items-center justify-between">
          <QaiLogo size="md" />
          <Link href="/dashboard" className={buttonVariants({ variant: "outline", size: "sm" })}>Open Qai</Link>
        </Container>
      </header>

      <section className="bg-[radial-gradient(circle_at_80%_20%,rgba(79,107,255,0.15),transparent_34%),linear-gradient(180deg,#fff_0%,var(--background)_100%)]">
        <Container className="py-14 sm:py-20 lg:py-24">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <section className="max-w-xl text-left">
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-primary">Made for creative businesses</p>
              <h1 className="mt-5 text-4xl font-bold leading-[1.06] tracking-tight text-foreground sm:text-5xl lg:text-6xl">Run your business.<br />Delight your clients.</h1>
              <p className="mt-6 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg">Connect requests, bookings, schedules, invoices, payments, reminders, and reports in one clear workspace.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/dashboard" className={buttonVariants({ size: "lg", className: "w-full sm:w-auto" })}>Go to dashboard <ArrowRight aria-hidden="true" /></Link>
                <a href="#features" className={buttonVariants({ variant: "outline", size: "lg", className: "w-full sm:w-auto" })}>See how it works</a>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="size-4 text-primary" />Simple to start</span>
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="size-4 text-primary" />Works on mobile</span>
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="size-4 text-primary" />Your data stays yours</span>
              </div>
            </section>

            <section className="relative min-w-0" aria-label="Qai dashboard preview">
              <div className="pointer-events-none absolute -inset-5 rounded-[2rem] bg-primary/10 blur-2xl" aria-hidden="true" />
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
      </section>

      <section id="features" className="border-y border-border bg-white py-16 sm:py-20">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-primary">One connected workspace</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Less admin. More time for your work.</h2>
            <p className="mt-4 text-muted-foreground">Qai keeps the everyday parts of a creative business together without becoming complicated accounting software.</p>
          </div>
          <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Feature icon={CalendarDays} title="Bookings" description="Manage single and multi-session work in one place." />
            <Feature icon={FileText} title="Invoices" description="Create clear invoices linked to real bookings." />
            <Feature icon={WalletCards} title="Payments" description="See paid, part paid, and unpaid at a glance." />
            <Feature icon={BarChart3} title="Reports" description="Understand income, expenses, and estimated profit." />
          </div>
        </Container>
      </section>

      <section className="py-16 sm:py-20">
        <Container>
          <div className="mx-auto max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-primary">FAQ</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">A few useful answers</h2>
            <div className="mt-8 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-white">
              <Faq question="Is Qai an accounting system?">No. Qai is a focused business workspace for bookings, schedules, invoices, payments, expenses, and practical reporting.</Faq>
              <Faq question="Can one booking have several dates?">Yes. Each booking can contain multiple independently editable schedule sessions on consecutive or non-consecutive dates.</Faq>
              <Faq question="Does Qai process my clients' payments?">No. Qai currently records and tracks your manual payment workflow; it is not a client-to-business payment gateway.</Faq>
              <Faq question="Can I use Qai on my phone?">Yes. Qai is a responsive web app and can be installed as a PWA on supported phones and computers.</Faq>
            </div>
          </div>
        </Container>
      </section>

      <footer className="border-t border-border bg-white py-8">
        <Container className="flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
          <QaiLogo size="sm" />
          <p>Run your business. Delight your clients.</p>
        </Container>
      </footer>
    </main>
  );
}

function Feature({ icon: Icon, title, description }: { icon: typeof CalendarDays; title: string; description: string }) {
  return <article className="rounded-2xl border border-border bg-card p-5"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" aria-hidden="true" /></span><h3 className="mt-5 font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p></article>;
}

function Faq({ question, children }: { question: string; children: React.ReactNode }) {
  return <details className="group px-5 py-4 open:bg-slate-50"><summary className="cursor-pointer list-none pr-8 font-semibold marker:content-none">{question}<span className="float-right text-primary transition-transform group-open:rotate-45" aria-hidden="true">+</span></summary><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{children}</p></details>;
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
