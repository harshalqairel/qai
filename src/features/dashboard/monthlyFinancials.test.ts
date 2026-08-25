import { describe, expect, it } from "vitest";

import type { Booking } from "@/features/booking/types";
import type { Expense } from "@/features/expense/types";
import { getMonthlyExpenses } from "@/features/expense/utils/expenseAggregations";
import type { Payment } from "@/features/payment/types";
import { getMonthlyRealizedRevenue } from "@/features/payment/utils/reportAggregations";
import { buildFinancialReport } from "@/features/reports/financialReport";

describe("Dashboard and Reports monthly financial truth", () => {
  it("uses the same actual payments, expenses, and realized profit totals", () => {
    const booking: Booking = {
      id: "booking-1", customerId: "customer-1", serviceId: "service-1", sessions: [{ id: "session-1", bookingId: "booking-1", sequence: 1, label: "", startAt: "2026-01-10T02:00:00.000Z", endAt: "2026-01-10T03:00:00.000Z", location: "", notes: "", createdAt: 1, updatedAt: 1 }],
      servicePrice: 2_000, bookingStatus: "Cancelled", fullPaymentDueDate: "2026-01-10", notes: "", createdAt: 1, updatedAt: 1,
    };
    const payments: Payment[] = [{ id: "payment-1", bookingId: booking.id, date: "2026-01-05", amount: 1_000, method: "Bank Transfer", notes: "", createdAt: 1 }];
    const expenses: Expense[] = [{ id: "expense-1", date: "2026-01-06", categoryId: "category-1", amount: 300, paymentMethod: "Cash", expenseType: "Booking Expense", bookingId: booking.id, vendor: "Vendor", notes: "", createdAt: 1, updatedAt: 1 }];
    const report = buildFinancialReport({
      businessName: "Qai", currency: "IDR", timezone: "Asia/Jakarta", period: { preset: "specific-month", selectedMonth: "2026-01" },
      bookings: [booking], customers: [{ id: "customer-1", name: "Client", phone: "", instagram: "", email: "", notes: "", createdAt: 1 }],
      services: [{ id: "service-1", name: "Service", categoryId: "service-category-1", price: 2_000, duration: 60, defaultSessionCount: 1, description: "", active: true }],
      payments, expenses, expenseCategories: [{ id: "category-1", name: "Direct", color: "category-slate", active: true, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }],
      generatedAt: new Date("2026-01-31T00:00:00.000Z"),
    });
    const revenue = getMonthlyRealizedRevenue(payments, 2026)[0];
    const expense = getMonthlyExpenses(expenses, 2026)[0];
    expect({ revenue, expense, profit: revenue - expense }).toEqual({ revenue: report.summary.moneyReceived, expense: report.summary.expenses, profit: report.summary.realizedProfit });
  });
});
