import Container from "@/components/ui/Container";
import Link from "next/link";
import { QaiLogo } from "@/components/brand/QaiLogo";
import { buttonVariants } from "@/components/ui/button";
import { ArrowRight, BarChart3, CalendarDays, CheckCircle2, CircleDollarSign, FileText, Menu, PanelsTopLeft, Sparkles, UsersRound, WalletCards } from "lucide-react";
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
    <main className="min-h-screen w-full flex-1 overflow-x-hidden bg-[#fbfafb]">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/88 backdrop-blur-xl">
        <Container className="flex h-18 max-w-[90rem] items-center justify-between">
          <QaiLogo size="md" />
          <nav className="hidden items-center gap-7 text-sm font-semibold text-muted-foreground md:flex" aria-label="Landing page">
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#workflow" className="transition-colors hover:text-foreground">How it works</a>
            <a href="#qai-space" className="transition-colors hover:text-foreground">Qai Space</a>
            <a href="#faq" className="transition-colors hover:text-foreground">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm", className: "hidden sm:inline-flex" })}>Log in</Link>
            <Link href="/dashboard" className={buttonVariants({ size: "sm" })}>Start for free</Link>
            <a href="#features" aria-label="Open page navigation" className="flex size-10 items-center justify-center rounded-lg text-foreground md:hidden"><Menu className="size-5" /></a>
          </div>
        </Container>
      </header>

      <section className="relative isolate overflow-hidden bg-[radial-gradient(circle_at_72%_16%,rgba(122,63,100,0.16),transparent_30%),radial-gradient(circle_at_88%_78%,rgba(79,115,169,0.12),transparent_26%),linear-gradient(180deg,#fff_0%,#faf7f9_100%)]">
        <div className="pointer-events-none absolute -right-28 top-28 -z-10 size-[34rem] rounded-full border border-primary/10" />
        <Container className="max-w-[90rem] py-12 sm:py-16 lg:py-20 xl:py-24">
          <div className="grid w-full items-center gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:gap-14 xl:gap-20">
            <section className="max-w-2xl text-left">
              <p className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white/70 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.15em] text-primary"><Sparkles className="size-3.5" /> Made for creative businesses</p>
              <h1 className="mt-6 text-4xl font-bold leading-[1.03] tracking-[-0.045em] text-foreground sm:text-5xl lg:text-[3.65rem] xl:text-[4.15rem]">Run your business.<br />Delight your clients.</h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">One calm workspace for bookings, schedules, clients, invoices, payments, expenses, and reports—designed for service professionals who would rather focus on their craft.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/dashboard" className={buttonVariants({ size: "lg", className: "w-full shadow-lg shadow-primary/15 sm:w-auto" })}>Start free <ArrowRight aria-hidden="true" /></Link>
                <a href="#features" className={buttonVariants({ variant: "outline", size: "lg", className: "w-full sm:w-auto" })}>See how it works</a>
              </div>
              <div className="mt-8 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="size-4 shrink-0 text-primary" />Simple to start</span>
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="size-4 shrink-0 text-primary" />Works on mobile</span>
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="size-4 shrink-0 text-primary" />Your data stays yours</span>
              </div>
            </section>

            <section className="relative min-w-0" aria-label="Qai dashboard preview">
              <div className="pointer-events-none absolute -inset-8 rounded-[3rem] bg-primary/10 blur-3xl" aria-hidden="true" />
              <div className="relative overflow-hidden rounded-[1.4rem] border border-black/8 bg-white p-3 shadow-[0_28px_80px_rgba(16,27,52,0.16)] sm:p-5 lg:mr-7">
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
              <div className="absolute -bottom-8 -right-1 hidden w-44 overflow-hidden rounded-[1.8rem] border-[7px] border-[#171725] bg-white shadow-2xl sm:block lg:w-48">
                <div className="mx-auto mt-2 h-1.5 w-14 rounded-full bg-[#171725]" />
                <div className="p-3"><div className="flex items-center justify-between"><QaiLogo variant="symbol" size="sm" /><span className="text-[9px] font-semibold">Bookings</span></div><div className="mt-3 space-y-2"><PhoneJob name="Wedding Makeup" amount="Rp 1.500.000" /><PhoneJob name="Studio Session" amount="Rp 850.000" /><PhoneJob name="Makeup Class" amount="Rp 600.000" /></div><div className="mt-3 rounded-full bg-primary px-3 py-2 text-center text-[10px] font-bold text-white">+ New booking</div></div>
              </div>
            </section>
          </div>
          <div className="mt-14 grid gap-3 border-t border-black/7 pt-6 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <TrustPoint icon={CalendarDays} title="Mobile-first" detail="Built for work on the go" />
            <TrustPoint icon={CheckCircle2} title="Easy to use" detail="Learn it in minutes" />
            <TrustPoint icon={WalletCards} title="Secure & reliable" detail="Your records stay connected" />
            <TrustPoint icon={UsersRound} title="Loved by pros" detail="Made for service businesses" />
          </div>
        </Container>
      </section>

      <section id="features" className="border-y border-border bg-white py-16 sm:py-24">
        <Container className="max-w-[86rem]">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-primary">One connected workspace</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Less admin. More time for your work.</h2>
            <p className="mt-4 text-muted-foreground">Qai keeps the everyday parts of a creative business together without becoming complicated accounting software.</p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Feature icon={CalendarDays} title="Bookings" description="Manage single and multi-session work in one place." />
            <Feature icon={FileText} title="Invoices" description="Create clear invoices linked to real bookings." />
            <Feature icon={WalletCards} title="Payments" description="See paid, part paid, and unpaid at a glance." />
            <Feature icon={BarChart3} title="Reports" description="Understand income, expenses, and estimated profit." />
          </div>
        </Container>
      </section>

      <section id="workflow" className="py-16 sm:py-24">
        <Container className="max-w-[86rem]">
          <div className="grid items-center gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div><p className="text-sm font-bold uppercase tracking-[0.16em] text-primary">A connected day of work</p><h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">From first request to paid invoice—without copying the same details twice.</h2><p className="mt-5 max-w-xl leading-7 text-muted-foreground">Qai reuses the same client, service, schedule, and price across the tools you need. Each screen stays focused, while the business record remains consistent.</p></div>
            <div className="grid gap-3 sm:grid-cols-2"><WorkflowStep number="01" title="Capture the booking" detail="Create it manually or review structured details pasted from a client message." /><WorkflowStep number="02" title="Run the schedule" detail="See every session on your calendar, including multi-day work." /><WorkflowStep number="03" title="Track the money" detail="Record payments and expenses without turning Qai into accounting software." /><WorkflowStep number="04" title="Share professionally" detail="Issue an invoice and publish a polished Qai Space for your business." /></div>
          </div>
        </Container>
      </section>

      <section id="qai-space" className="bg-[#16131a] py-16 text-white sm:py-24">
        <Container className="max-w-[86rem]">
          <div className="grid items-center gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-14"><div><p className="text-sm font-bold uppercase tracking-[0.16em] text-[#c99db9]">Your public Qai Space</p><h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">A portfolio that can turn interest into a real booking.</h2><p className="mt-5 leading-7 text-white/65">Show selected work, services, location, and contact details while keeping your own business identity first.</p><Link href="/space" className={buttonVariants({ variant: "secondary", size: "lg", className: "mt-7" })}>Explore Qai Space <ArrowRight /></Link></div><div className="grid grid-cols-12 gap-3"><div className="col-span-7 aspect-[4/3] rounded-2xl bg-[linear-gradient(145deg,#9a6882,#313d62)] p-5"><PanelsTopLeft className="size-7" /><p className="mt-20 text-2xl font-bold">Your best work,<br />beautifully presented.</p></div><div className="col-span-5 grid gap-3"><div className="aspect-square rounded-2xl bg-[#ede3e8]" /><div className="aspect-[4/3] rounded-2xl bg-[#647da6]" /></div></div></div>
        </Container>
      </section>

      <section id="faq" className="py-16 sm:py-24">
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
          <p>Run. Delight. Grow.</p>
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

function PhoneJob({ name, amount }: { name: string; amount: string }) {
  return <div className="rounded-lg border border-border p-2"><p className="truncate text-[10px] font-bold">{name}</p><p className="mt-1 text-[9px] text-muted-foreground">Upcoming</p><p className="mt-1 text-right text-[9px] font-semibold">{amount}</p></div>;
}

function TrustPoint({ icon: Icon, title, detail }: { icon: typeof CalendarDays; title: string; detail: string }) {
  return <div className="flex items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-primary shadow-sm"><Icon className="size-4" /></span><div><p className="font-semibold">{title}</p><p className="text-xs text-muted-foreground">{detail}</p></div></div>;
}

function WorkflowStep({ number, title, detail }: { number: string; title: string; detail: string }) {
  return <article className="rounded-2xl border border-border bg-white p-5 shadow-sm"><p className="text-xs font-bold tracking-[0.16em] text-primary">{number}</p><h3 className="mt-5 font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p></article>;
}
