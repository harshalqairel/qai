"use client";

import { useRouter } from "next/navigation";
import type { EnrichedBooking } from "@/features/dashboard/hooks/useDashboard";
import { formatRupiah } from "@/features/payment/utils/paymentCalculations";
import { formatDashboardDate, getOverdueAgeDays } from "@/features/dashboard/utils";
import ReminderActions from "@/features/reminder/components/ReminderActions";

type PaymentDueListProps = {
  title: "Payments Due Soon" | "Late Payments";
  description: string;
  emptyMessage: string;
  items: EnrichedBooking[];
  late?: boolean;
  todayKey: string;
  businessName: string;
};

export default function PaymentDueList({
  title,
  description,
  emptyMessage,
  items,
  late = false,
  todayKey,
  businessName,
}: PaymentDueListProps) {
  const router = useRouter();
  const openBooking = (id: string) => router.push(`/bookings?booking=${encodeURIComponent(id)}`);
  return (
    <section>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--dashboard-text)]">{title}</h2>
          <p className="mt-1 text-sm text-[var(--dashboard-muted-text)]">{description}</p>
        </div>
        {items.length > 0 && (
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              late
                ? "bg-[var(--dashboard-expense-soft)] text-[var(--dashboard-expense-text)]"
                : "bg-[var(--dashboard-unpaid-soft)] text-[var(--dashboard-unpaid-text)]"
            }`}
          >
            {items.length}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-[var(--dashboard-border)] bg-[var(--dashboard-surface-muted)] p-6 text-center text-sm text-[var(--dashboard-muted-text)]">
          {emptyMessage}
        </div>
      ) : (
        <div className="mt-5 divide-y divide-[var(--dashboard-border)]">
          {items.map((booking) => {
            const overdueDays = late ? getOverdueAgeDays(booking.fullPaymentDueDate, todayKey) : 0;
            return (
            <article key={booking.id} role="link" tabIndex={0} onClick={() => openBooking(booking.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openBooking(booking.id); } }} className="cursor-pointer rounded-xl py-4 transition hover:bg-[var(--dashboard-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring first:pt-0 last:pb-0 sm:px-2">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[var(--dashboard-text)]">
                    {booking.customerName}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-[var(--dashboard-muted-text)]">
                    {booking.serviceName}
                  </p>
                  <p className={`mt-2 text-sm font-medium ${late ? "text-[var(--dashboard-expense-text)]" : "text-[var(--dashboard-unpaid-text)]"}`}>
                    {late ? `${overdueDays} day${overdueDays === 1 ? "" : "s"} overdue` : `Due ${formatDashboardDate(booking.fullPaymentDueDate)}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end">
                  <p className="font-semibold text-[var(--dashboard-text)] tabular-nums">
                    {formatRupiah(booking.remainingAmount)} <span className="font-normal text-[var(--dashboard-muted-text)]">remaining</span>
                  </p>
                  {late && <p className="text-xs text-[var(--dashboard-muted-text)]">Due {formatDashboardDate(booking.fullPaymentDueDate)}</p>}
                </div>
              </div>
              <ReminderActions bookingId={booking.id} customerId={booking.customerId} customerName={booking.customerName} customerPhone={booking.customerPhone} customerEmail={booking.customerEmail} serviceName={booking.serviceName} businessName={businessName} remainingAmount={booking.remainingAmount} dueDate={formatDashboardDate(booking.fullPaymentDueDate)} />
            </article>
          );})}
        </div>
      )}
    </section>
  );
}
