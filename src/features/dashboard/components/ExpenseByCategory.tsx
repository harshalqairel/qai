import type { ExpenseCategoryItem } from "@/features/expense/utils/expenseAggregations";
import { formatRupiah } from "@/features/payment/utils/paymentCalculations";

type ExpenseByCategoryProps = {
  items: ExpenseCategoryItem[];
};

export default function ExpenseByCategory({ items }: ExpenseByCategoryProps) {
  const max = Math.max(...items.map((item) => item.amount), 0);

  return (
    <section>
      <div>
        <h2 className="text-lg font-semibold text-[var(--dashboard-text)]">Expenses by Category</h2>
        <p className="mt-1 text-sm text-[var(--dashboard-muted-text)]">Expenses in the selected period, grouped by category.</p>
      </div>

      {items.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-[var(--dashboard-border)] bg-[var(--dashboard-surface-muted)] p-6 text-center text-sm text-[var(--dashboard-muted-text)]">
          No expenses recorded yet.
        </div>
      ) : (
        <ul className="mt-5 space-y-4">
          {items.map((item) => {
            const width = max === 0 ? 0 : Math.max(3, (item.amount / max) * 100);
            return (
              <li key={item.category}>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="min-w-0 truncate text-sm font-medium text-[var(--dashboard-text)]">
                    {item.category}
                  </span>
                  <div className="flex shrink-0 items-baseline gap-2">
                    <span className="text-sm font-semibold text-[var(--dashboard-text)] tabular-nums">
                      {formatRupiah(item.amount)}
                    </span>
                    <span className="text-xs text-[var(--dashboard-muted-text)]">{item.percentage}%</span>
                  </div>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--dashboard-surface-muted)]">
                  <div
                    className="h-full rounded-full bg-[var(--dashboard-expense)]"
                    style={{ width: `${width}%` }}
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
