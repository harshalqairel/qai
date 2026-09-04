import type { DerivedPaymentStatus } from "@/features/payment/types";

const PAYMENT_STATUS_QUERY: Record<DerivedPaymentStatus, string> = {
  Outstanding: "outstanding",
  "Partial Paid": "partial",
  Overdue: "overdue",
  "Fully Paid": "paid",
  Cancelled: "cancelled",
};

const PAYMENT_STATUS_BY_QUERY = Object.fromEntries(
  Object.entries(PAYMENT_STATUS_QUERY).map(([status, query]) => [query, status]),
) as Record<string, DerivedPaymentStatus>;

export function paymentStatusFromQuery(value: string | null): DerivedPaymentStatus | "" {
  if (!value) return "";
  return PAYMENT_STATUS_BY_QUERY[value.trim().toLowerCase()] ?? "";
}

export function paymentStatusToQuery(value: string): string {
  return PAYMENT_STATUS_QUERY[value as DerivedPaymentStatus] ?? "";
}

export function bookingPaymentHref(
  paymentStatus: DerivedPaymentStatus,
  bookingId?: string,
): string {
  const params = new URLSearchParams({ payment: paymentStatusToQuery(paymentStatus) });
  if (bookingId) params.set("booking", bookingId);
  return `/bookings?${params.toString()}`;
}
