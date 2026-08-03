import type { Booking } from "@/features/booking/types";

type EnrichedBooking = Booking & { customerName: string; serviceName: string };

type UpcomingProps = { items: EnrichedBooking[] };

export default function UpcomingBookings({ items }: UpcomingProps) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-slate-900">Upcoming Bookings</h3>
      {items.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-500">No upcoming bookings.</div>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-3">
              <div>
                <div className="font-medium text-slate-900">{b.customerName} — {b.serviceName}</div>
                <div className="text-sm text-zinc-600">{b.bookingDate} • {b.startTime}{b.endTime ? ` – ${b.endTime}` : ''}</div>
              </div>
              <div className="text-sm text-zinc-700">{b.bookingStatus}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
