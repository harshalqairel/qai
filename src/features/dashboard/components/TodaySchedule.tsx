import type { Booking } from "@/features/booking/types";

type EnrichedBooking = Booking & { customerName: string; serviceName: string };
type TodayScheduleProps = { items: EnrichedBooking[] };

function statusBadge(status: string) {
  const badgeClasses =
    status === "Scheduled"
      ? "bg-emerald-100 text-emerald-700"
      : status === "Completed"
      ? "bg-sky-100 text-sky-700"
      : "bg-red-100 text-red-700";

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${badgeClasses}`}>
      {status}
    </span>
  );
}

export default function TodaySchedule({ items }: TodayScheduleProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">Today's Schedule</h2>
      {items.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-500">No bookings for today.</div>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4">
              <div>
                <div className="font-medium text-slate-900">{b.customerName} — {b.serviceName}</div>
                <div className="text-sm text-zinc-600">{b.startTime}{b.endTime ? ` – ${b.endTime}` : ''} • {b.location}</div>
              </div>
              <div>{statusBadge(b.bookingStatus)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
