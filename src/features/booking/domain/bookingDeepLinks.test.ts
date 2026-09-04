import { describe, expect, it } from "vitest";

import { derivePaymentStatus } from "@/features/payment/utils/paymentCalculations";
import { bookingPaymentHref, paymentStatusFromQuery, paymentStatusToQuery } from "./bookingDeepLinks";

describe("booking payment deep links", () => {
  it.each([
    ["Outstanding", "/bookings?payment=outstanding&booking=booking-1"],
    ["Partial Paid", "/bookings?payment=partial&booking=booking-1"],
    ["Overdue", "/bookings?payment=overdue&booking=booking-1"],
    ["Fully Paid", "/bookings?payment=paid&booking=booking-1"],
    ["Cancelled", "/bookings?payment=cancelled&booking=booking-1"],
  ] as const)("routes %s Dashboard bookings to their matching filter", (status, expected) => {
    expect(bookingPaymentHref(status, "booking-1")).toBe(expected);
  });

  it("routes both unpaid and partially paid past-due bookings to Overdue", () => {
    const overdueUnpaid = derivePaymentStatus("Scheduled", 0, 8_000_000, "2026-09-01", "2026-09-03");
    const overduePartial = derivePaymentStatus("Scheduled", 3_000_000, 8_000_000, "2026-09-01", "2026-09-03");

    expect(bookingPaymentHref(overdueUnpaid, "unpaid-overdue")).toBe(
      "/bookings?payment=overdue&booking=unpaid-overdue",
    );
    expect(bookingPaymentHref(overduePartial, "partial-overdue")).toBe(
      "/bookings?payment=overdue&booking=partial-overdue",
    );
  });

  it("does not route paid or cancelled bookings to Overdue", () => {
    const paid = derivePaymentStatus("Scheduled", 8_000_000, 8_000_000, "2026-09-01", "2026-09-03");
    const cancelled = derivePaymentStatus("Cancelled", 0, 8_000_000, "2026-09-01", "2026-09-03");

    expect(bookingPaymentHref(paid, "paid-booking")).toContain("payment=paid");
    expect(bookingPaymentHref(cancelled, "cancelled-booking")).toContain("payment=cancelled");
  });

  it.each([
    ["outstanding", "Outstanding"],
    ["partial", "Partial Paid"],
    ["overdue", "Overdue"],
    ["paid", "Fully Paid"],
    ["cancelled", "Cancelled"],
    ["OVERDUE", "Overdue"],
    ["unknown", ""],
    [null, ""],
  ] as const)("initializes the Bookings filter from %s", (query, expected) => {
    expect(paymentStatusFromQuery(query)).toBe(expected);
  });

  it("uses the same canonical mapping when a Bookings filter changes", () => {
    expect(paymentStatusToQuery("Outstanding")).toBe("outstanding");
    expect(paymentStatusToQuery("Partial Paid")).toBe("partial");
    expect(paymentStatusToQuery("Overdue")).toBe("overdue");
    expect(paymentStatusToQuery("Fully Paid")).toBe("paid");
    expect(paymentStatusToQuery("Cancelled")).toBe("cancelled");
    expect(paymentStatusToQuery("invalid")).toBe("");
  });

  it("preserves an encoded Booking identifier for notification links", () => {
    expect(bookingPaymentHref("Overdue", "booking/with spaces")).toBe(
      "/bookings?payment=overdue&booking=booking%2Fwith+spaces",
    );
  });
});
