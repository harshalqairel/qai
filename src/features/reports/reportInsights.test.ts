import { describe, expect, it } from "vitest";
import type { Booking } from "@/features/booking/types";
import type { FinancialReport } from "@/features/reports/financialReport";
import { buildFinancialReportInsights } from "./reportInsights";

const baseReport: FinancialReport = {
  businessName: "Qai", currency: "IDR", timezone: "Asia/Jakarta", generatedAt: "2026-08-16T00:00:00.000Z",
  period: { preset: "this-month", fromDate: "2026-08-01", toDate: "2026-08-31", label: "August 2026" },
  summary: { moneyReceived: 3_000, expenses: 500, realizedProfit: 2_500, expectedBookingValue: 6_000, estimatedJobProfit: 6_000, outstanding: 3_000, clientTotal: 6_000, paid: 3_000, directExpenses: 0, profit: 6_000, bookings: 3, scheduledSessions: 4 },
  moneyReceived: [
    { paymentId: "p1", date: "2026-08-02", bookingId: "b1", customer: "A", service: "Makeup", bookingStatus: "Scheduled", method: "Cash", amount: 2_000, notes: "" },
    { paymentId: "p2", date: "2026-08-03", bookingId: "b2", customer: "B", service: "Photo", bookingStatus: "Completed", method: "Cash", amount: 1_000, notes: "" },
  ],
  expenses: [], jobProfit: [], outstanding: [],
  bookings: [
    { bookingId: "b1", serviceId: "service-makeup", firstSessionDate: "2026-08-10", customer: "A", service: "Makeup", status: "Scheduled", paymentStatus: "Partial Paid", sessionCount: 1, servicePrice: 4_000, additionalCharges: 0, bookingValue: 4_000, totalPaid: 2_000, outstanding: 2_000, directExpenses: 0, estimatedJobProfit: 4_000, paymentDueDate: "2026-08-18", notes: "" },
    { bookingId: "b2", serviceId: "service-photo", firstSessionDate: "2026-08-11", customer: "B", service: "Photo", status: "Completed", paymentStatus: "Partial Paid", sessionCount: 1, servicePrice: 2_000, additionalCharges: 0, bookingValue: 2_000, totalPaid: 1_000, outstanding: 1_000, directExpenses: 0, estimatedJobProfit: 2_000, paymentDueDate: "2026-08-22", notes: "" },
    { bookingId: "b3", serviceId: "service-other", firstSessionDate: "2026-08-12", customer: "C", service: "Other", status: "Cancelled", paymentStatus: "Cancelled", sessionCount: 1, servicePrice: 99_000, additionalCharges: 0, bookingValue: 99_000, totalPaid: 0, outstanding: null, directExpenses: 0, estimatedJobProfit: null, paymentDueDate: "2026-08-20", notes: "" },
  ],
  topServices: [
    { serviceId: "service-makeup", service: "Makeup", bookingCount: 1, revenue: 4_000 },
    { serviceId: "service-photo", service: "Photo", bookingCount: 1, revenue: 2_000 },
  ],
  schedule: [
    { sessionId: "s1", bookingId: "b1", sequence: 1, label: "", sessionContext: "Schedule 1", date: "2026-08-10", startAt: "2026-08-10T02:00:00.000Z", endAt: "2026-08-10T03:00:00.000Z", location: "", customer: "A", service: "Makeup", bookingStatus: "Scheduled", notes: "" },
    { sessionId: "s2", bookingId: "b2", sequence: 1, label: "", sessionContext: "Schedule 1", date: "2026-08-17", startAt: "2026-08-17T02:00:00.000Z", endAt: "2026-08-17T03:00:00.000Z", location: "", customer: "B", service: "Photo", bookingStatus: "Completed", notes: "" },
  ],
  invoices: [],
};

function booking(id: string, status: Booking["bookingStatus"], due: string, price: number): Booking {
  return { id, customerId: `c-${id}`, serviceId: `s-${id}`, sessions: [{ id: `session-${id}`, bookingId: id, sequence: 1, label: "", startAt: "2026-08-20T02:00:00.000Z", endAt: "2026-08-20T03:00:00.000Z", location: "", notes: "", createdAt: 1, updatedAt: 1 }], servicePrice: price, additionalCharges: [], bookingStatus: status, fullPaymentDueDate: due, notes: "", createdAt: 1, updatedAt: 1 };
}

describe("financial report insights", () => {
  it("uses centralized active booking values for average booking value", () => {
    const insight = buildFinancialReportInsights({ report: baseReport, bookings: [], payments: [], expenses: [], todayKey: "2026-08-16" });
    expect(insight.averageBookingValue).toBe(3_000);
    expect(insight.financiallyActiveBookings).toBe(2);
  });

  it("uses the canonical client-total ranking for top service and derives the busiest schedule day", () => {
    const insight = buildFinancialReportInsights({ report: baseReport, bookings: [], payments: [], expenses: [], todayKey: "2026-08-16" });
    expect(insight.topService).toEqual({ serviceId: "service-makeup", service: "Makeup", bookingCount: 1, revenue: 4_000 });
    expect(insight.busiestScheduleDay).toEqual({ label: "Monday", schedules: 2 });
  });

  it("labels and limits future-looking payments to seven days and excludes cancelled bookings", () => {
    const bookings = [booking("b1", "Scheduled", "2026-08-18", 4_000), booking("b2", "Completed", "2026-08-23", 2_000), booking("b3", "Cancelled", "2026-08-19", 10_000), booking("b4", "Scheduled", "2026-08-24", 5_000)];
    const insight = buildFinancialReportInsights({ report: baseReport, bookings, payments: [{ id: "paid", bookingId: "b1", date: "2026-08-10", amount: 1_000, method: "Cash", notes: "", createdAt: 1 }], expenses: [], todayKey: "2026-08-16" });
    expect(insight.upcomingPayments).toEqual({ amount: 5_000, bookings: 2, throughDate: "2026-08-23" });
  });
});
