"use client";

import { useRouter } from "next/navigation";
import type { ScheduledSessionItem } from "@/features/dashboard/hooks/useDashboard";
import { formatSessionTime } from "@/features/booking/utils/bookingSessions";
import { BookingStatusBadge, PaymentStatusBadge } from "./DashboardStatusBadge";
import { paymentStatusLabel } from "@/features/payment/utils/paymentCalculations";
import { bookingPaymentHref } from "@/features/booking/domain/bookingDeepLinks";

type TodayScheduleProps = {
  items: ScheduledSessionItem[];
  timezone: string;
};

export default function TodaySchedule({ items, timezone }: TodayScheduleProps) {
  const router = useRouter();
  const openBooking = (booking: ScheduledSessionItem) => router.push(bookingPaymentHref(booking.paymentStatus, booking.id));
  const first = items[0];
  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Today</p>
          <h2 className="mt-1 hidden text-lg font-semibold text-[var(--dashboard-text)] lg:block">Today&apos;s schedule</h2>
        </div>
        <span className="text-sm font-semibold tabular-nums text-[var(--dashboard-muted-text)]">
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="mt-4 py-2">
          <p className="font-semibold text-[var(--dashboard-text)]">No bookings today.</p>
          <p className="mt-1 text-sm text-[var(--dashboard-muted-text)]">Your schedule is clear.</p>
          <button type="button" onClick={() => router.push("/calendar")} className="mt-2 min-h-10 text-sm font-semibold text-primary hover:underline">Open calendar →</button>
        </div>
      ) : (
        <>
          {first && <article role="link" tabIndex={0} onClick={() => openBooking(first)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openBooking(first); } }} className="mt-4 grid cursor-pointer grid-cols-[3.75rem_minmax(0,1fr)] gap-3 border-y border-[var(--dashboard-border)] py-4 lg:hidden">
            <p className="font-semibold tabular-nums text-[var(--dashboard-text)]">{formatSessionTime(first.session, timezone).split("–")[0]}</p>
            <div className="min-w-0">
              <p className="truncate font-semibold text-[var(--dashboard-text)]">{first.customerName}</p>
              <p className="mt-0.5 truncate text-sm text-[var(--dashboard-muted-text)]">{first.serviceName}{first.session.label ? ` · ${first.session.label}` : ""}</p>
              <p className="mt-2 truncate text-sm text-[var(--dashboard-muted-text)]">{first.session.location.trim() || "Location not set"} · <span className="font-medium text-[var(--dashboard-text)]">{paymentStatusLabel(first.paymentStatus)}</span></p>
            </div>
          </article>}
          <div className="mt-3 flex items-center justify-between gap-3 lg:hidden">
            <span className="text-sm text-[var(--dashboard-muted-text)]">{items.length > 1 ? `${items.length - 1} more today` : "Your only booking today"}</span>
            <button type="button" onClick={() => router.push("/calendar")} className="min-h-10 text-sm font-semibold text-primary hover:underline">View calendar</button>
          </div>
        <div className="mt-5 hidden space-y-3 lg:block">
          {items.map((booking) => (
            <article
              key={booking.session.id}
              role="link"
              tabIndex={0}
              onClick={() => openBooking(booking)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openBooking(booking);
                }
              }}
              className="cursor-pointer rounded-xl border border-[var(--dashboard-border)] bg-white p-4 transition hover:border-[var(--brand)] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        </>
      )}
    </section>
  );
}
