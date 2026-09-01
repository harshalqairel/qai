import { describe, expect, it } from "vitest";

import { calculateBookingFinancials } from "@/features/booking/domain/bookingFinancials";
import type { Booking } from "@/features/booking/types";
import { instantParts } from "@/features/booking/utils/bookingSessions";
import type { Payment } from "@/features/payment/types";
import { derivePaymentStatus, summarizeBookingPayments } from "./paymentCalculations";

const TODAY = "2026-08-31";

function booking(changes: Partial<Booking> = {}): Booking {
  return {
    id: "booking-1",
    customerId: "customer-1",
    serviceId: "service-1",
    sessions: [],
    servicePrice: 7_500_000,
    additionalCharges: [{
      id: "charge-1",
      bookingId: "booking-1",
      sessionId: null,
      categoryId: "transport",
      categoryName: "Transport",
      description: "",
      amount: 500_000,
      createdAt: 1,
      updatedAt: 1,
    }],
    bookingStatus: "Scheduled",
    fullPaymentDueDate: "2026-09-01",
    notes: "",
    createdAt: 1,
    updatedAt: 1,
    ...changes,
  };
}

function payment(amount: number): Payment {
  return {
    id: `payment-${amount}`,
    bookingId: "booking-1",
    date: TODAY,
    amount,
    method: "Bank Transfer",
    notes: "",
    createdAt: 1,
  };
}

describe("derived booking payment status", () => {
  it("keeps unpaid balances Unpaid before and on their due date", () => {
    expect(derivePaymentStatus("Scheduled", 0, 8_000_000, "2026-09-01", TODAY)).toBe("Outstanding");
    expect(derivePaymentStatus("Scheduled", 0, 8_000_000, TODAY, TODAY)).toBe("Outstanding");
  });

  it("marks an unpaid past-due balance Overdue", () => {
    expect(derivePaymentStatus("Scheduled", 0, 8_000_000, "2026-08-30", TODAY)).toBe("Overdue");
  });

  it("keeps partial future balances Partial and marks partial past-due balances Overdue", () => {
    expect(derivePaymentStatus("Scheduled", 3_000_000, 8_000_000, "2026-09-01", TODAY)).toBe("Partial Paid");
    expect(derivePaymentStatus("Scheduled", 3_000_000, 8_000_000, "2026-08-30", TODAY)).toBe("Overdue");
  });

  it("keeps a fully paid past-due booking Paid and clears Overdue after the exact balance is paid", () => {
    expect(derivePaymentStatus("Scheduled", 8_000_000, 8_000_000, "2026-08-30", TODAY)).toBe("Fully Paid");
    const before = summarizeBookingPayments([{ ...booking(), fullPaymentDueDate: "2026-08-30" }], [payment(2_000_000)], TODAY);
    const after = summarizeBookingPayments([{ ...booking(), fullPaymentDueDate: "2026-08-30" }], [payment(2_000_000), { ...payment(6_000_000), id: "payment-final", createdAt: 2 }], TODAY);
    expect(before["booking-1"].paymentStatus).toBe("Overdue");
    expect(after["booking-1"]).toMatchObject({ totalPaid: 8_000_000, remainingAmount: 0, paymentStatus: "Fully Paid" });
  });

  it("does not mark a cancelled booking Overdue", () => {
    expect(derivePaymentStatus("Cancelled", 0, 8_000_000, "2026-08-30", TODAY)).toBe("Cancelled");
  });

  it("does not infer Overdue when the due date is missing or invalid", () => {
    expect(derivePaymentStatus("Scheduled", 0, 8_000_000, undefined, TODAY)).toBe("Outstanding");
    expect(derivePaymentStatus("Scheduled", 2_000_000, 8_000_000, "2026-02-30", TODAY)).toBe("Partial Paid");
  });

  it("uses the Indonesia business-local date at UTC boundaries", () => {
    const instant = "2026-08-31T17:30:00.000Z";
    const jakartaToday = instantParts(instant, "Asia/Jakarta").date;
    const utcToday = instantParts(instant, "UTC").date;
    expect({ jakartaToday, utcToday }).toEqual({ jakartaToday: "2026-09-01", utcToday: "2026-08-31" });
    expect(derivePaymentStatus("Scheduled", 0, 8_000_000, "2026-08-31", jakartaToday)).toBe("Overdue");
    expect(derivePaymentStatus("Scheduled", 0, 8_000_000, "2026-08-31", utcToday)).toBe("Outstanding");
  });

  it("changes status only and leaves every financial total unchanged", () => {
    const value = booking({ fullPaymentDueDate: "2026-08-30" });
    const paid = [payment(2_000_000)];
    const totalsBefore = calculateBookingFinancials(value, paid, []);
    const summary = summarizeBookingPayments([value], paid, TODAY)[value.id];
    const totalsAfter = calculateBookingFinancials(value, paid, []);
    expect(summary).toMatchObject({ totalPaid: 2_000_000, remainingAmount: 6_000_000, paymentStatus: "Overdue" });
    expect(totalsAfter).toEqual(totalsBefore);
    expect(totalsAfter).toMatchObject({ clientTotal: 8_000_000, totalPaid: 2_000_000, outstanding: 6_000_000, estimatedJobProfit: 8_000_000 });
  });

  it("re-derives the same status from persisted values after a reload round trip", () => {
    const persistedBooking = JSON.parse(JSON.stringify(booking({ fullPaymentDueDate: "2026-08-30" }))) as Booking;
    const persistedPayments = JSON.parse(JSON.stringify([payment(2_000_000)])) as Payment[];
    expect(summarizeBookingPayments([persistedBooking], persistedPayments, TODAY)[persistedBooking.id].paymentStatus).toBe("Overdue");
  });
});
