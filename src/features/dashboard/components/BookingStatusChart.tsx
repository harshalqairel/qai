type BookingStatusChartProps = { counts: Record<string, number> };

export default function BookingStatusChart({ counts }: BookingStatusChartProps) {
  const total = Object.values(counts).reduce((s, v) => s + v, 0);

  return (
    <div>
      <h3 className="text-lg font-semibold text-slate-900">Booking Status</h3>
      <div className="mt-4 flex gap-4">
        {Object.entries(counts).map(([k, v]) => (
          <div key={k} className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full" style={{ background: k === "Scheduled" ? "#10b981" : k === "Completed" ? "#0ea5e9" : "#f43f5e" }} />
            <div>
              <div className="font-medium text-slate-900">{k}</div>
              <div className="text-sm text-zinc-600">{v} ({total === 0 ? 0 : Math.round((v / total) * 100)}%)</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
