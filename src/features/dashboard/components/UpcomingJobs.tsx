import type { EnrichedBooking } from "@/features/dashboard/hooks/useDashboard";
import { formatDashboardDate } from "@/features/dashboard/utils";
import { BookingStatusBadge, PaymentStatusBadge } from "./DashboardStatusBadge";

type UpcomingJobsProps = {
  items: EnrichedBooking[];
};

export default function UpcomingJobs({ items }: UpcomingJobsProps) {
  return (
    <section>
      <div>
        <h2 className="text-lg font-semibold text-[var(--dashboard-text)]">Upcoming Jobs</h2>
        <p className="mt-1 text-sm text-[var(--dashboard-muted-text)]">Your next scheduled jobs.</p>
      </div>

      {items.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-[var(--dashboard-border)] bg-[var(--dashboard-surface-muted)] p-6 text-center text-sm text-[var(--dashboard-muted-text)]">
          No upcoming jobs.
        </div>
      ) : (
        <div className="mt-5 divide-y divide-[var(--dashboard-border)]">
          {items.map((booking) => (
            <article key={booking.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--dashboard-text)]">{booking.customerName}</p>
                  <p className="mt-0.5 text-sm text-[var(--dashboard-muted-text)]">{booking.serviceName}</p>
                  <p className="mt-2 text-sm font-medium text-[var(--dashboard-text)]">
                    {formatDashboardDate(booking.bookingDate)} · {booking.startTime}
                    {booking.endTime ? `??{booking.endTime}` : ""}
                  </p>
                  {booking.location.trim() && (
                    <p className="mt-1 text-sm text-[var(--dashboard-muted-text)]">{booking.location}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <BookingStatusBadge status={booking.bookingStatus} />
                  <PaymentStatusBadge status={booking.paymentStatus} />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
