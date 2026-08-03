import type { IncomeByServiceItem } from "@/features/dashboard/hooks/useDashboard";
import { formatRupiah } from "@/features/payment/utils/paymentCalculations";

type IncomeByServiceProps = {
  items: IncomeByServiceItem[];
};

export default function IncomeByService({ items }: IncomeByServiceProps) {
  const max = Math.max(...items.map((item) => item.revenue), 0);

  return (
    <section>
      <div>
        <h2 className="text-lg font-semibold text-[var(--dashboard-text)]">Income by Service</h2>
        <p className="mt-1 text-sm text-[var(--dashboard-muted-text)]">All-time money received for each service.</p>
      </div>

      {items.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-[var(--dashboard-border)] bg-[var(--dashboard-surface-muted)] p-6 text-center text-sm text-[var(--dashboard-muted-text)]">
          No service income recorded yet.
        </div>
      ) : (
        <ul className="mt-5 space-y-4">
          {items.map((item) => {
            const width = max === 0 ? 0 : Math.max(3, (item.revenue / max) * 100);
            return (
              <li key={item.serviceId}>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="min-w-0 truncate text-sm font-medium text-[var(--dashboard-text)]">
                    {item.serviceName || "Service not found"}
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-[var(--dashboard-text)] tabular-nums">
                    {formatRupiah(item.revenue)}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--dashboard-surface-muted)]">
                  <div
                    className="h-full rounded-full bg-[var(--dashboard-income)]"
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
