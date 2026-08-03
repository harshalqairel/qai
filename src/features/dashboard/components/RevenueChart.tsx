import type { RevenuePoint } from "@/features/dashboard/hooks/useDashboard";
import { formatRupiah } from "@/features/payment/utils/paymentCalculations";

type RevenueChartProps = { data: RevenuePoint[] };

const SERIES = [
  { key: "realized" as const, label: "Realized",  color: "bg-emerald-500" },
  { key: "expenses" as const, label: "Expenses",  color: "bg-rose-400"    },
  { key: "net"      as const, label: "Net",        color: "bg-sky-500"     },
];

export default function RevenueChart({ data }: RevenueChartProps) {
  const allValues = data.flatMap((d) => [d.realized, d.expenses, Math.max(0, d.net)]);
  const max = Math.max(...allValues, 0);
  const steps = 4;
  const ticks = Array.from({ length: steps + 1 }, (_, i) =>
    Math.round((max / steps) * (steps - i)),
  );

  function barHeight(value: number) {
    if (max === 0) return 8;
    return Math.max(8, Math.round((Math.max(0, value) / max) * 140));
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Monthly Revenue</h3>
        <div className="flex gap-4">
          {SERIES.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5 text-xs text-zinc-600">
              <span className={`h-2.5 w-2.5 rounded-full ${s.color}`} />
              {s.label}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        {/* Y-axis ticks */}
        <div className="flex w-20 shrink-0 flex-col justify-between pb-6 text-right">
          {ticks.map((t, i) => (
            <div key={i} className="text-[10px] leading-none text-zinc-400">
              {formatRupiah(t)}
            </div>
          ))}
        </div>

        {/* Bars */}
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex items-end gap-1" style={{ height: "160px" }}>
            {data.map((d) => (
              <div key={d.label} className="flex flex-1 flex-col items-center gap-0.5">
                <div className="flex w-full items-end justify-center gap-0.5" style={{ height: "140px" }}>
                  {SERIES.map((s) => (
                    <div
                      key={s.key}
                      title={`${d.label} ${s.label}: ${formatRupiah(d[s.key])}`}
                      className={`flex-1 rounded-t-md ${s.color} opacity-90 transition-all`}
                      style={{ height: `${barHeight(d[s.key])}px` }}
                    />
                  ))}
                </div>
                <div className="mt-1 truncate text-[10px] text-zinc-400">{d.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
