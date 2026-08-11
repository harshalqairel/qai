import type { ScheduledSessionItem } from "@/features/dashboard/hooks/useDashboard";
import { formatSessionTime } from "@/features/booking/utils/bookingSessions";
import { BookingStatusBadge, PaymentStatusBadge } from "./DashboardStatusBadge";

type TodayScheduleProps = {
  items: ScheduledSessionItem[];
  timezone: string;
};

export default function TodaySchedule({ items, timezone }: TodayScheduleProps) {
  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--dashboard-text)]">Today&apos;s schedule</h2>
          <p className="mt-1 text-sm text-[var(--dashboard-muted-text)]">Work planned for today.</p>
        </div>
        <span className="rounded-full bg-[var(--dashboard-income-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--dashboard-income-text)]">
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-[var(--dashboard-border)] bg-[var(--dashboard-surface-muted)] p-6 text-center text-sm text-[var(--dashboard-muted-text)]">
          No bookings on this day.
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {items.map((booking) => (
            <article
              key={booking.session.id}
              className="rounded-xl border border-[var(--dashboard-border)] bg-white p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[var(--dashboard-text)]">
                    {booking.customerName}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-[var(--dashboard-muted-text)]">
                    {booking.serviceName}{booking.session.label ? ` · ${booking.session.label}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <BookingStatusBadge status={booking.bookingStatus} />
                  <PaymentStatusBadge status={booking.paymentStatus} />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-[var(--dashboard-border)] pt-3 text-sm text-[var(--dashboard-muted-text)]">
                <span className="font-medium text-[var(--dashboard-text)]">
                  {formatSessionTime(booking.session, timezone)}
                </span>
                {booking.session.location.trim() && <span>{booking.session.location}</span>}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
