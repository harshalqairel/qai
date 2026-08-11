import { CircleAlertIcon, HandCoinsIcon, ReceiptTextIcon, TrendingUpIcon } from "lucide-react";
import { formatRupiah } from "@/features/payment/utils/paymentCalculations";
import type { KPI, KPITone } from "@/features/dashboard/hooks/useDashboard";
import Link from "next/link";

type KPICardProps = {
  metric: KPI;
  periodQuery?: string;
};

const TONE_STYLES: Record<
  KPITone,
  {
    accentBorder: string;
    soft: string;
    iconText: string;
    Icon: typeof HandCoinsIcon;
  }
> = {
  received: {
    accentBorder: "border-l-4 border-l-[var(--dashboard-income)]",
    soft: "bg-[var(--dashboard-income-soft)]",
    iconText: "text-[var(--dashboard-income-text)]",
    Icon: HandCoinsIcon,
  },
  unpaid: {
    accentBorder: "border-l-4 border-l-[var(--dashboard-unpaid)]",
    soft: "bg-[var(--dashboard-unpaid-soft)]",
    iconText: "text-[var(--dashboard-unpaid-text)]",
    Icon: CircleAlertIcon,
  },
  expenses: {
    accentBorder: "border-l-4 border-l-[var(--dashboard-expense)]",
    soft: "bg-[var(--dashboard-expense-soft)]",
    iconText: "text-[var(--dashboard-expense-text)]",
    Icon: ReceiptTextIcon,
  },
  profit: {
    accentBorder: "border-l-4 border-l-[var(--dashboard-profit)]",
    soft: "bg-[var(--dashboard-profit-soft)]",
    iconText: "text-[var(--dashboard-profit-text)]",
    Icon: TrendingUpIcon,
  },
};

export default function KPICard({ metric, periodQuery }: KPICardProps) {
  const tone = TONE_STYLES[metric.tone];
  const Icon = tone.Icon;

  return (
    <Link href={metric.label === "Unpaid amount" ? "/bookings?payment=outstanding" : `/reports${periodQuery ? `?${periodQuery}` : ""}`} className={`block min-w-0 rounded-2xl border border-[var(--dashboard-border)] bg-[var(--dashboard-card)] p-5 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${tone.accentBorder}`}>
      <div className="flex items-center justify-between gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone.soft}`}>
          <Icon className={`h-5 w-5 ${tone.iconText}`} aria-hidden="true" />
        </div>
        <span className="text-xs font-medium text-[var(--dashboard-muted-text)]">
          {metric.period}
        </span>
      </div>
      <p className="mt-5 text-sm font-medium text-[var(--dashboard-muted-text)]">{metric.label}</p>
      <p className="mt-1 break-words text-2xl font-semibold tracking-tight text-[var(--dashboard-text)] tabular-nums sm:text-[1.65rem]">
        {formatRupiah(metric.value)}
      </p>
    </Link>
  );
}
