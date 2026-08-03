import type { BookingStatus } from "@/features/booking/types";

type BookingStatusChartProps = {
  counts: Record<BookingStatus, number>;
};

const STATUS_STYLES: Record<BookingStatus, string> = {
  Scheduled: "bg-[var(--dashboard-income)]",
  Completed: "bg-[var(--dashboard-profit)]",
  Cancelled: "bg-[var(--dashboard-expense)]",
};

const STATUSES: BookingStatus[] = ["Scheduled", "Completed", "Cancelled"];

export default function BookingStatusChart({ counts }: BookingStatusChartProps) {
  const total = STATUSES.reduce((sum, status) => sum + counts[status], 0);

  return (
    <section>
      <div>
        <h2 className="text-lg font-semibold text-[var(--dashboard-text)]">Booking Status</h2>
        <p className="mt-1 text-sm text-[var(--dashboard-muted-text)]">All bookings by current status.</p>
      </div>

      <div className="mt-5 space-y-4">
        {STATUSES.map((status) => {
          const percentage = total === 0 ? 0 : Math.round((counts[status] / total) * 100);
          return (
            <div key={status}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 font-medium text-[var(--dashboard-text)]">
                  <span className={`h-2.5 w-2.5 rounded-full ${STATUS_STYLES[status]}`} aria-hidden="true" />
                  {status}
                </span>
                <span className="text-[var(--dashboard-muted-text)]">
                  {counts[status]} · {percentage}%
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--dashboard-surface-muted)]">
                <div
                  className={`h-full rounded-full ${STATUS_STYLES[status]}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
