import type { BookingStatus } from "@/features/booking/types";
import type { DerivedPaymentStatus } from "@/features/payment/types";

const BOOKING_STYLES: Record<BookingStatus, string> = {
  Scheduled: "bg-[var(--dashboard-income-soft)] text-[var(--dashboard-income-text)]",
  Completed: "bg-[var(--dashboard-profit-soft)] text-[var(--dashboard-profit-text)]",
  Cancelled: "bg-[var(--dashboard-expense-soft)] text-[var(--dashboard-expense-text)]",
};

const PAYMENT_DETAILS: Record<DerivedPaymentStatus, { label: string; style: string }> = {
  Outstanding: {
    label: "Unpaid",
    style: "bg-[var(--dashboard-unpaid-soft)] text-[var(--dashboard-unpaid-text)]",
  },
  "Partial Paid": {
    label: "Part paid",
    style: "bg-[var(--dashboard-profit-soft)] text-[var(--dashboard-profit-text)]",
  },
  Overdue: {
    label: "Overdue",
    style: "bg-[var(--dashboard-expense-soft)] text-[var(--dashboard-expense-text)]",
  },
  "Fully Paid": {
    label: "Paid",
    style: "bg-[var(--dashboard-income-soft)] text-[var(--dashboard-income-text)]",
  },
  Cancelled: {
    label: "Cancelled",
    style: "bg-[var(--dashboard-surface-muted)] text-[var(--dashboard-muted-text)]",
  },
};

const BASE_CLASS = "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold";

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return <span className={`${BASE_CLASS} ${BOOKING_STYLES[status]}`}>{status}</span>;
}

export function PaymentStatusBadge({ status }: { status: DerivedPaymentStatus }) {
  const details = PAYMENT_DETAILS[status];
  return <span className={`${BASE_CLASS} ${details.style}`}>{details.label}</span>;
}
