"use client";

import { useRouter } from "next/navigation";
import type { ScheduledSessionItem } from "@/features/dashboard/hooks/useDashboard";
import { formatSessionDate, formatSessionTime } from "@/features/booking/utils/bookingSessions";
import { BookingStatusBadge, PaymentStatusBadge } from "./DashboardStatusBadge";

type UpcomingJobsProps = {
  items: ScheduledSessionItem[];
  timezone: string;
};

export default function UpcomingJobs({ items, timezone }: UpcomingJobsProps) {
  const router = useRouter();
  const openBooking = (id: string) => router.push(`/bookings?booking=${encodeURIComponent(id)}`);
  return (
    <section>
      <div>
        <h2 className="text-lg font-semibold text-[var(--dashboard-text)]">Upcoming jobs</h2>
        <p className="mt-1 text-sm text-[var(--dashboard-muted-text)]">Your next scheduled jobs.</p>
      </div>

      {items.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-[var(--dashboard-border)] bg-[var(--dashboard-surface-muted)] p-6 text-center text-sm text-[var(--dashboard-muted-text)]">
          No upcoming jobs.
        </div>
      ) : (
        <div className="mt-5 divide-y divide-[var(--dashboard-border)]">
          {items.map((booking) => (
            <article key={booking.session.id} role="link" tabIndex={0} onClick={() => openBooking(booking.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openBooking(booking.id); } }} className="cursor-pointer rounded-xl py-4 transition hover:bg-[var(--dashboard-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring first:pt-0 last:pb-0 sm:px-2">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--dashboard-text)]">{booking.customerName}</p>
                  <p className="mt-0.5 text-sm text-[var(--dashboard-muted-text)]">
                    {booking.serviceName}{booking.session.label ? ` · ${booking.session.label}` : ""}
                  </p>
                  <p className="mt-2 text-sm font-medium text-[var(--dashboard-text)]">
                    {formatSessionDate(booking.session, timezone)} {"\u00b7"}{" "}
                    {formatSessionTime(booking.session, timezone)}
                  </p>
                  {booking.session.location.trim() && (
                    <p className="mt-1 text-sm text-[var(--dashboard-muted-text)]">{booking.session.location}</p>
                  )}
                  {booking.sessions.length > 1 && <p className="mt-2 text-xs font-medium text-[var(--dashboard-muted-text)]">{booking.sessions.length}-schedule booking</p>}
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
