import Link from "next/link";
import { ArrowRight, CalendarDays, CircleAlert, Inbox } from "lucide-react";

type NeedsAttentionProps = {
  overdueCount: number;
  dueSoonCount: number;
  requestCount: number;
  todayCount: number;
};

const attentionItems = [
  {
    key: "overdue",
    label: "Overdue payments",
    description: "Follow up on balances past their due date.",
    href: "/bookings?payment=outstanding",
    Icon: CircleAlert,
    tone: "text-[var(--dashboard-expense-text)] bg-[var(--dashboard-expense-soft)]",
  },
  {
    key: "dueSoon",
    label: "Payments due soon",
    description: "Review the next balances coming due.",
    href: "/bookings?payment=outstanding",
    Icon: CalendarDays,
    tone: "text-[var(--dashboard-unpaid-text)] bg-[var(--dashboard-unpaid-soft)]",
  },
  {
    key: "requests",
    label: "New requests",
    description: "Respond to work requested from your Qai Page.",
    href: "/qai-page",
    Icon: Inbox,
    tone: "text-[var(--dashboard-income-text)] bg-[var(--dashboard-income-soft)]",
  },
] as const;

export default function NeedsAttention({ overdueCount, dueSoonCount, requestCount, todayCount }: NeedsAttentionProps) {
  const counts = { overdue: overdueCount, dueSoon: dueSoonCount, requests: requestCount };
  const visibleItems = attentionItems.filter((item) => counts[item.key] > 0);

  return (
    <section className="surface-card min-w-0 p-5 sm:p-6" aria-labelledby="needs-attention-heading">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--dashboard-muted-text)]">Your day</p>
          <h2 id="needs-attention-heading" className="mt-1 text-xl font-semibold text-[var(--dashboard-text)]">
            {visibleItems.length > 0 ? "Needs attention" : "You’re up to date"}
          </h2>
          <p className="mt-1 text-sm text-[var(--dashboard-muted-text)]">
            {todayCount > 0
              ? `${todayCount} scheduled ${todayCount === 1 ? "session" : "sessions"} today.`
              : "No scheduled sessions today."}
          </p>
        </div>
        <Link href="/bookings?new=1" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Add booking <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>

      {visibleItems.length > 0 && (
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {visibleItems.map((item) => {
            const count = counts[item.key];
            return (
              <Link key={item.key} href={item.href} className="group flex min-h-24 items-start gap-3 rounded-xl border border-[var(--dashboard-border)] p-4 transition hover:border-[var(--brand)] hover:bg-[var(--dashboard-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${item.tone}`}>
                  <item.Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[var(--dashboard-text)]">{item.label}</span>
                    <span className="tabular-nums text-sm font-semibold text-[var(--dashboard-text)]">{count}</span>
                  </span>
                  <span className="mt-1 block text-sm leading-5 text-[var(--dashboard-muted-text)]">{item.description}</span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
