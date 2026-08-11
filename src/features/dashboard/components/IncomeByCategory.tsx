import type { IncomeByCategoryItem } from "@/features/dashboard/hooks/useDashboard";
import { formatRupiah } from "@/features/payment/utils/paymentCalculations";

type IncomeByCategoryProps = {
  items: IncomeByCategoryItem[];
};

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const NEUTRAL_COLOR = "var(--dashboard-muted)";

function getIndicatorColor(color?: string) {
  return color && HEX_COLOR.test(color) ? color : NEUTRAL_COLOR;
}

export default function IncomeByCategory({ items }: IncomeByCategoryProps) {
  const max = Math.max(...items.map((item) => item.revenue), 0);

  return (
    <section>
      <div>
        <h2 className="text-lg font-semibold text-[var(--dashboard-text)]">Income by Category</h2>
        <p className="mt-1 text-sm text-[var(--dashboard-muted-text)]">Income in the selected period, grouped by service category.</p>
      </div>

      {items.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-[var(--dashboard-border)] bg-[var(--dashboard-surface-muted)] p-6 text-center text-sm text-[var(--dashboard-muted-text)]">
          No category income recorded yet.
        </div>
      ) : (
        <ul className="mt-5 space-y-4">
          {items.map((item) => {
            const width = max === 0 ? 0 : Math.max(3, (item.revenue / max) * 100);
            const indicatorColor = getIndicatorColor(item.categoryColor);
            return (
              <li key={item.categoryId}>
                <div className="flex items-baseline justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: indicatorColor }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 truncate text-sm font-medium text-[var(--dashboard-text)]">
                      {item.categoryName}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-baseline gap-2">
                    <span className="text-sm font-semibold text-[var(--dashboard-text)] tabular-nums">
                      {formatRupiah(item.revenue)}
                    </span>
                    <span className="text-xs text-[var(--dashboard-muted-text)]">{item.percentage}%</span>
                  </div>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--dashboard-surface-muted)]">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${width}%`, backgroundColor: indicatorColor }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
