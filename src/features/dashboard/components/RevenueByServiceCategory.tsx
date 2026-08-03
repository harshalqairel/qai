import type { RevenueCategoryItem } from "@/features/dashboard/hooks/useDashboard";
import { formatRupiah } from "@/features/payment/utils/paymentCalculations";

type Props = { items: RevenueCategoryItem[] };

const CATEGORY_COLORS: Record<string, string> = {
  Wedding: "bg-rose-500",
  "Studio Rental": "bg-violet-500",
  "Self Makeup Class": "bg-amber-500",
  "Professional Class": "bg-sky-500",
  "Food & Beverage": "bg-emerald-500",
  Other: "bg-zinc-400",
};

function colorFor(category: string): string {
  return CATEGORY_COLORS[category] ?? "bg-zinc-400";
}

export default function RevenueByServiceCategory({ items }: Props) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-slate-900">Revenue by Category</h3>
      {items.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-500">
          No payment data yet.
        </div>
      ) : (
        <>
          {/* Stacked bar */}
          <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full">
            {items.map((item) => (
              <div
                key={item.category}
                title={`${item.category}: ${item.percentage}%`}
                className={`${colorFor(item.category)} transition-all`}
                style={{ width: `${item.percentage}%` }}
              />
            ))}
          </div>

          {/* Legend + values */}
          <ul className="mt-4 space-y-3">
            {items.map((item) => (
              <li key={item.category} className="flex items-center gap-3">
                <span className={`h-3 w-3 shrink-0 rounded-full ${colorFor(item.category)}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium text-slate-800">{item.category}</span>
                    <span className="shrink-0 text-sm font-semibold text-slate-900">{formatRupiah(item.revenue)}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className={`h-full ${colorFor(item.category)} rounded-full`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
                <span className="w-10 shrink-0 text-right text-xs text-zinc-500">{item.percentage}%</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
