import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { formatRupiah } from "@/features/payment/utils/paymentCalculations";
import { donutGradient, groupAnalyticsCategories, type AnalyticsCategory } from "../analytics";

const PALETTE = ["#0d7571", "#294c73", "#4d7c8a", "#7ea6a3", "#94a3b8"];

export default function FinancialAnalyticsCard({
  title,
  total,
  period,
  categories,
  href,
  emptyMessage,
  tone,
}: {
  title: "Income" | "Expenses";
  total: number;
  period: string;
  categories: AnalyticsCategory[];
  href: string;
  emptyMessage: string;
  tone: "income" | "expenses";
}) {
  const display = groupAnalyticsCategories(categories.map((item, index) => ({
    ...item,
    color: item.color ?? PALETTE[index % PALETTE.length],
  })));
  const fallback = tone === "income" ? "var(--dashboard-income)" : "var(--dashboard-expense)";

  return (
    <article className="surface-card min-w-0 p-5 sm:p-6">
      <Link href={href} className="group block rounded-lg focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Open ${title.toLowerCase()} report for ${period}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--dashboard-muted-text)]">{title}</p>
            <p className="mt-2 break-words text-2xl font-bold tracking-tight text-[var(--dashboard-text)] tabular-nums sm:text-3xl">{formatRupiah(total)}</p>
            <p className="mt-1 text-sm text-[var(--dashboard-muted-text)]">{period}</p>
          </div>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--dashboard-surface-muted)] text-[var(--dashboard-muted-text)] transition group-hover:text-[var(--dashboard-text)]">
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </span>
        </div>
      </Link>

      {display.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-[var(--dashboard-border)] bg-[var(--dashboard-surface-muted)] p-6 text-center text-sm text-[var(--dashboard-muted-text)]">
          {emptyMessage}
        </div>
      ) : (
        <div className="mt-6 grid min-w-0 items-center gap-6 sm:grid-cols-[132px_minmax(0,1fr)]">
          <div className="relative mx-auto size-32 shrink-0" role="img" aria-label={`${title} category distribution`}>
            <div className="absolute inset-0 rounded-full" style={{ background: donutGradient(display, fallback) }} />
            <div className="absolute inset-5 flex items-center justify-center rounded-full bg-white text-center">
              <span className="text-xs font-semibold text-[var(--dashboard-muted-text)]">{display.length}<br />categor{display.length === 1 ? "y" : "ies"}</span>
            </div>
          </div>
          <ul className="min-w-0 space-y-3">
            {display.map((item) => (
              <li key={item.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 text-sm">
                <span className="flex min-w-0 items-center gap-2 font-medium text-[var(--dashboard-text)]">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color ?? fallback }} aria-hidden="true" />
                  <span className="truncate">{item.name}</span>
                </span>
                <span className="text-right font-semibold text-[var(--dashboard-text)] tabular-nums">{formatRupiah(item.amount)}</span>
                <span className="col-start-2 text-right text-xs text-[var(--dashboard-muted-text)]">{item.percentage}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
