"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Search } from "lucide-react";

import { Input } from "@/components/ui/input";

const TASKS = [
  { group: "Get started", title: "Set up services", description: "Create categories, services, prices, schedules, and optional client choices.", href: "/services" },
  { group: "Get started", title: "Add a client", description: "Save contact details once, then reuse them in bookings and invoices.", href: "/customers?new=1" },
  { group: "Daily work", title: "Create a booking", description: "Choose a client and service, then add every schedule and the payment due date.", href: "/bookings?new=1" },
  { group: "Daily work", title: "Record a payment", description: "Open a booking and record each real payment received. Qai updates the balance.", href: "/bookings" },
  { group: "Daily work", title: "Record an expense", description: "Choose whether the cost belongs to the business or to a specific booking.", href: "/expenses?new=1" },
  { group: "Qai Space", title: "Set up your Qai Space", description: "Add your business identity, contact details, and public link.", href: "/space?tab=Profile" },
  { group: "Qai Space", title: "Customize your Space", description: "Choose a template, colors, typography, and section order.", href: "/space?tab=Design" },
  { group: "Qai Space", title: "Add services to your Space", description: "Choose which operational Services clients can see and book.", href: "/space?tab=Services" },
  { group: "Qai Space", title: "Add portfolio work", description: "Present selected work without changing your operational records.", href: "/space?tab=Portfolio" },
  { group: "Qai Space", title: "Manage booking requests", description: "Review new client bookings and convert them into Qai Bookings.", href: "/space?tab=Requests" },
  { group: "Qai Space", title: "Share your Space", description: "Preview your public presence, then copy its client-facing link.", href: "/space?tab=Preview" },
  { group: "Client experience", title: "Customize booking questions", description: "Ask only the details your business needs and target questions to services.", href: "/settings?section=booking-questions" },
  { group: "Money", title: "Review unpaid work", description: "See financially active balances and take action without changing invoice status.", href: "/reports" },
  { group: "Money", title: "Create and share an invoice", description: "Create a draft, review its calculation, issue it, then share the PDF.", href: "/invoices?new=1" },
  { group: "Protect your data", title: "Export or restore data", description: "Download a backup or import a reviewed spreadsheet without partial saves.", href: "/settings?section=data-backup" },
] as const;

export default function HowToUseQai() {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase();
    return keyword ? TASKS.filter((task) => `${task.group} ${task.title} ${task.description}`.toLocaleLowerCase().includes(keyword)) : TASKS;
  }, [query]);
  const groups = [...new Set(results.map((task) => task.group))];

  return (
    <section className="surface-card overflow-hidden">
      <header className="border-b border-border p-5 sm:p-7">
        <p className="section-kicker">Help center</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight">Qai Guide</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Find a task and go directly to the place where it is completed.</p>
        <div className="relative mt-5 max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="Search bookings, invoices, data…" aria-label="Search the Qai Guide" />
        </div>
      </header>

      <div className="divide-y divide-border">
        {groups.map((group) => (
          <section key={group} className="p-5 sm:p-7" aria-labelledby={`guide-${group.replaceAll(" ", "-").toLowerCase()}`}>
            <h3 id={`guide-${group.replaceAll(" ", "-").toLowerCase()}`} className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{group}</h3>
            <div className="mt-3 grid gap-x-6 sm:grid-cols-2">
              {results.filter((task) => task.group === group).map((task) => (
                <Link key={task.title} href={task.href} className="group flex min-h-28 items-start gap-3 border-b border-border/70 py-4 transition-colors hover:text-primary">
                  <span className="min-w-0 flex-1"><span className="block font-semibold text-foreground group-hover:text-primary">{task.title}</span><span className="mt-1 block text-sm leading-6 text-muted-foreground">{task.description}</span></span>
                  <ArrowRight className="mt-1 size-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </section>
        ))}
        {results.length === 0 && <div className="p-8 text-center"><p className="font-semibold">No guide matches “{query.trim()}”</p><p className="mt-2 text-sm text-muted-foreground">Try a shorter task name such as booking, invoice, or export.</p></div>}
      </div>
    </section>
  );
}
