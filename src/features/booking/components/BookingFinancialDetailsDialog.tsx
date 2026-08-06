"use client";

import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Booking } from "@/features/booking/types";
import type { Payment, DerivedPaymentStatus } from "@/features/payment/types";
import { formatRupiah } from "@/features/payment/utils/paymentCalculations";

export type BookingFinancialDetails = Booking & {
  customerName: string;
  serviceName: string;
  paymentStatus: DerivedPaymentStatus;
  totalPaid: number;
  remainingAmount: number | null;
  directExpenses: number;
  estimatedProfit: number | null;
  cashPosition: number | null;
};

type BookingFinancialDetailsDialogProps = {
  open: boolean;
  booking: BookingFinancialDetails | null;
  payments: Payment[];
  onClose: () => void;
  onAddPayment: (bookingId: string, remainingAmount: number) => void;
  onAddExpense: (bookingId: string) => void;
};

function isPaymentAllowed(booking: BookingFinancialDetails): boolean {
  return booking.bookingStatus !== "Cancelled" && (booking.remainingAmount ?? 0) > 0;
}

function paymentStatusLabel(status: DerivedPaymentStatus): string {
  if (status === "Outstanding") return "Unpaid";
  if (status === "Partial Paid") return "Part paid";
  if (status === "Fully Paid") return "Paid";
  return "Cancelled";
}

function valueClass(value: number): string {
  return value < 0 ? "text-destructive" : "text-foreground";
}

export default function BookingFinancialDetailsDialog({
  open,
  booking,
  payments,
  onClose,
  onAddPayment,
  onAddExpense,
}: BookingFinancialDetailsDialogProps) {
  if (!open || !booking) {
    return null;
  }

  const bookingPayments = payments
    .filter((payment) => payment.bookingId === booking.id)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const canAddPayment = isPaymentAllowed(booking);
  const canAddExpense = booking.bookingStatus !== "Cancelled";
  const isCancelled = booking.bookingStatus === "Cancelled";

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-end bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <section
        aria-label={`Financial details for ${booking.customerName}`}
        className="h-dvh w-full max-w-xl overflow-y-auto border-l border-border bg-white p-5 shadow-xl sm:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h2 className="dialog-title">Payment Details</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {booking.customerName} · {booking.serviceName}
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close payment details">
            <XIcon className="size-5" aria-hidden="true" />
          </Button>
        </div>

        <section className="rounded-xl border border-border bg-muted/30 p-4" aria-label="Booking financial summary">
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-muted-foreground">Booking Status</p>
              <p className="mt-1 font-semibold">{booking.bookingStatus}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Booking Value</p>
              <p className="mt-1 font-semibold">{formatRupiah(booking.servicePrice)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">
                {isCancelled ? "Payments Recorded" : "Total Paid"}
              </p>
              <p className="mt-1 font-semibold">{formatRupiah(booking.totalPaid)}</p>
            </div>
            {!isCancelled && (
              <div>
                <p className="text-muted-foreground">Remaining</p>
                <p className="mt-1 font-semibold">{formatRupiah(booking.remainingAmount ?? 0)}</p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground">Payment Status</p>
              <p className="mt-1 font-semibold">{paymentStatusLabel(booking.paymentStatus)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Direct Expenses</p>
              <p className="mt-1 font-semibold">{formatRupiah(booking.directExpenses)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Est. Job Profit</p>
              <p className={`mt-1 font-semibold ${booking.estimatedProfit === null ? "" : valueClass(booking.estimatedProfit)}`}>
                {booking.estimatedProfit === null ? "Not applicable" : formatRupiah(booking.estimatedProfit)}
              </p>
            </div>
            {!isCancelled && (
              <div>
                <p className="text-muted-foreground">Cash Position</p>
                <p className={`mt-1 font-semibold ${valueClass(booking.cashPosition ?? 0)}`}>
                  {formatRupiah(booking.cashPosition ?? 0)}
                </p>
              </div>
            )}
          </div>
          {isCancelled && (
            <p className="mt-4 text-sm text-muted-foreground">
              Cancelled bookings are excluded from profit and outstanding totals.
            </p>
          )}
        </section>

        <section className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold">Payment History</h3>
            {canAddPayment && (
              <Button
                type="button"
                size="sm"
                onClick={() => onAddPayment(booking.id, booking.remainingAmount ?? 0)}
              >
                Add Payment
              </Button>
            )}
          </div>
          {bookingPayments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payment transactions yet.</p>
          ) : (
            <div className="space-y-2">
              {bookingPayments.map((payment) => (
                <article key={payment.id} className="rounded-xl border border-border p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{payment.date}</p>
                    <p className="font-semibold">{formatRupiah(payment.amount)}</p>
                  </div>
                  <p className="mt-1 text-muted-foreground">{payment.method}</p>
                  {payment.notes && <p className="mt-1 text-muted-foreground">{payment.notes}</p>}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-6 border-t border-border pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">Direct Expenses</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Only expenses linked to this booking are included.
              </p>
            </div>
            {canAddExpense && (
              <Button type="button" variant="outline" size="sm" onClick={() => onAddExpense(booking.id)}>
                Add Expense
              </Button>
            )}
          </div>
        </section>
      </section>
    </div>
  );
}
