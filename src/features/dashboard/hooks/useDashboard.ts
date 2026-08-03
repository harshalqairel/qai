"use client";

import { useMemo } from "react";
import { Booking } from "@/features/booking/types";
import { useBookings } from "@/features/booking/hooks/useBookings";
import { useCustomers } from "@/features/customer/hooks/useCustomers";
import { useServices } from "@/features/service/hooks/useServices";
import { usePayments } from "@/features/payment/hooks/usePayments";
import { useExpenses } from "@/features/expense/hooks/useExpenses";
import { formatRupiah, summarizeBookingPayments } from "@/features/payment/utils/paymentCalculations";
import {
  getMonthlyRealizedRevenue,
  getRevenueByCustomer,
  getRevenueByPaymentMethod,
  getRevenueByService,
} from "@/features/payment/utils/reportAggregations";
import {
  getMonthlyExpenses,
  getExpensesByCategory,
  ExpenseCategoryItem,
} from "@/features/expense/utils/expenseAggregations";

export type KPI = { label: string; value: string | number; sub?: string };
export type RevenuePoint = { label: string; realized: number; expenses: number; net: number };
export type RevenueCategoryItem = { category: string; revenue: number; percentage: number };
export type { ExpenseCategoryItem };
export type ActivityItem = {
  id: string;
  type: "booking" | "customer" | "service" | "payment" | "expense";
  text: string;
  timestamp: number;
};

type UseDashboardArgs = {
  selectedMonth: Date;
  chartRange: "year";
};

type EnrichedBooking = Booking & {
  customerName: string;
  serviceName: string;
  totalPaid: number;
  remainingAmount: number;
  paymentStatus: "Outstanding" | "Partial Paid" | "Fully Paid" | "Cancelled";
};

export function useDashboard({ selectedMonth }: UseDashboardArgs) {
  const { bookings } = useBookings();
  const { customers } = useCustomers();
  const { services } = useServices();
  const { payments } = usePayments();
  const { expenses } = useExpenses();

  const todayKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const paymentSummaries = useMemo(() => summarizeBookingPayments(bookings, payments), [bookings, payments]);

  const enrichedBookings = useMemo<EnrichedBooking[]>(() => {
    return bookings.map((booking) => {
      const customer = customers.find((item) => item.id === booking.customerId);
      const service = services.find((item) => item.id === booking.serviceId);
      const effectiveServicePrice = booking.servicePrice > 0 ? booking.servicePrice : service?.price ?? 0;
      const paymentSummary = paymentSummaries[booking.id];

      return {
        ...booking,
        servicePrice: effectiveServicePrice,
        customerName: customer?.name ?? "Unknown Customer",
        serviceName: service?.name ?? "Unknown Service",
        totalPaid: paymentSummary?.totalPaid ?? 0,
        remainingAmount: paymentSummary?.remainingAmount ?? effectiveServicePrice,
        paymentStatus: paymentSummary?.paymentStatus ?? "Outstanding",
      };
    });
  }, [bookings, customers, services, paymentSummaries]);

  const todaysSchedule = useMemo(() => {
    const list = enrichedBookings.filter((booking) => booking.bookingDate === todayKey);
    return [...list].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [enrichedBookings, todayKey]);

  const upcomingBookings = useMemo(() => {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    return enrichedBookings
      .filter((booking) => new Date(`${booking.bookingDate}T00:00:00`) >= todayStart)
      .sort((a, b) => {
        if (a.bookingDate !== b.bookingDate) return a.bookingDate.localeCompare(b.bookingDate);
        return a.startTime.localeCompare(b.startTime);
      })
      .slice(0, 7);
  }, [enrichedBookings]);

  const selectedYear = selectedMonth.getFullYear();

  const selectedMonthKey = useMemo(() => {
    const y = selectedMonth.getFullYear();
    const m = String(selectedMonth.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }, [selectedMonth]);

  // ── Monthly metrics ─────────────────────────────────────────
  const thisMonthRealized = useMemo(() => {
    return payments.reduce((sum, p) => {
      if (!p.date.startsWith(selectedMonthKey)) return sum;
      return sum + p.amount;
    }, 0);
  }, [payments, selectedMonthKey]);

  const thisMonthExpenses = useMemo(() => {
    return expenses.reduce((sum, e) => {
      if (!e.date.startsWith(selectedMonthKey)) return sum;
      return sum + e.amount;
    }, 0);
  }, [expenses, selectedMonthKey]);

  const thisMonthNet = thisMonthRealized - thisMonthExpenses;

  const thisMonthPotential = useMemo(() => {
    return enrichedBookings.reduce((sum, booking) => {
      if (booking.bookingStatus === "Cancelled") return sum;
      if (!booking.bookingDate.startsWith(selectedMonthKey)) return sum;
      return sum + Math.max(booking.remainingAmount, 0);
    }, 0);
  }, [enrichedBookings, selectedMonthKey]);

  // ── Yearly metrics ──────────────────────────────────────────
  const thisYearRealized = useMemo(() => {
    return payments.reduce((sum, p) => {
      const d = new Date(`${p.date}T00:00:00`);
      if (d.getFullYear() !== selectedYear) return sum;
      return sum + p.amount;
    }, 0);
  }, [payments, selectedYear]);

  const thisYearExpenses = useMemo(() => {
    return expenses.reduce((sum, e) => {
      const d = new Date(`${e.date}T00:00:00`);
      if (d.getFullYear() !== selectedYear) return sum;
      return sum + e.amount;
    }, 0);
  }, [expenses, selectedYear]);

  const thisYearNet = thisYearRealized - thisYearExpenses;

  const thisYearPotential = useMemo(() => {
    return enrichedBookings.reduce((sum, booking) => {
      if (booking.bookingStatus === "Cancelled") return sum;
      const d = new Date(`${booking.bookingDate}T00:00:00`);
      if (d.getFullYear() !== selectedYear) return sum;
      return sum + Math.max(booking.remainingAmount, 0);
    }, 0);
  }, [enrichedBookings, selectedYear]);

  // 8 KPIs — 4 month + 4 year
  const metrics = useMemo<KPI[]>(() => [
    { label: "This Month Realized",  value: thisMonthRealized,  sub: "Rp" },
    { label: "This Month Expenses",  value: thisMonthExpenses,  sub: "Rp" },
    { label: "This Month Net",       value: thisMonthNet,       sub: "Rp" },
    { label: "This Month Potential", value: thisMonthPotential, sub: "Rp" },
    { label: "This Year Realized",   value: thisYearRealized,   sub: "Rp" },
    { label: "This Year Expenses",   value: thisYearExpenses,   sub: "Rp" },
    { label: "This Year Net",        value: thisYearNet,        sub: "Rp" },
    { label: "This Year Potential",  value: thisYearPotential,  sub: "Rp" },
  ], [
    thisMonthRealized, thisMonthExpenses, thisMonthNet, thisMonthPotential,
    thisYearRealized, thisYearExpenses, thisYearNet, thisYearPotential,
  ]);

  // Multi-series revenue chart — realized, expenses, net per month
  const revenueSeries = useMemo<RevenuePoint[]>(() => {
    const realizedMonthly = getMonthlyRealizedRevenue(payments, selectedYear);
    const expensesMonthly = getMonthlyExpenses(expenses, selectedYear);

    return realizedMonthly.map((realized, i) => {
      const exp = expensesMonthly[i];
      return {
        label: new Date(selectedYear, i, 1).toLocaleString("en-US", { month: "short" }),
        realized,
        expenses: exp,
        net: realized - exp,
      };
    });
  }, [payments, expenses, selectedYear]);

  // Keep revenueLabels for backward compatibility
  const revenueLabels = useMemo(() => revenueSeries.map((item) => item.label), [revenueSeries]);

  const statusCounts = useMemo(() => {
    const counts = { Scheduled: 0, Completed: 0, Cancelled: 0 } as Record<string, number>;
    for (const booking of bookings) {
      counts[booking.bookingStatus] = (counts[booking.bookingStatus] ?? 0) + 1;
    }
    return counts;
  }, [bookings]);

  const revenueByCategory = useMemo<RevenueCategoryItem[]>(() => {
    const categoryMap = new Map<string, number>();

    for (const payment of payments) {
      const booking = bookings.find((b) => b.id === payment.bookingId);
      if (!booking || booking.bookingStatus === "Cancelled") continue;
      const service = services.find((s) => s.id === booking.serviceId);
      const category = service?.category ?? "Other";
      categoryMap.set(category, (categoryMap.get(category) ?? 0) + payment.amount);
    }

    const total = Array.from(categoryMap.values()).reduce((sum, v) => sum + v, 0);

    return Array.from(categoryMap.entries())
      .map(([category, revenue]) => ({
        category,
        revenue,
        percentage: total > 0 ? Math.round((revenue / total) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [payments, bookings, services]);

  const expenseByCategory = useMemo<ExpenseCategoryItem[]>(
    () => getExpensesByCategory(expenses),
    [expenses],
  );

  const recentCustomers = useMemo(() => {
    return [...customers].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
  }, [customers]);

  const activityFeed = useMemo(() => {
    const items: ActivityItem[] = [];

    for (const customer of customers) {
      items.push({
        id: `cust-${customer.id}`,
        type: "customer",
        text: `New customer: ${customer.name}`,
        timestamp: customer.createdAt,
      });
    }

    for (const booking of enrichedBookings) {
      items.push({
        id: `booking-${booking.id}`,
        type: "booking",
        text: `${booking.customerName} booked ${booking.serviceName}`,
        timestamp: booking.createdAt,
      });

      if (booking.bookingStatus === "Completed") {
        items.push({
          id: `booking-complete-${booking.id}`,
          type: "booking",
          text: `${booking.customerName} completed ${booking.serviceName}`,
          timestamp: booking.updatedAt,
        });
      }
    }

    for (const payment of payments) {
      const booking = enrichedBookings.find((item) => item.id === payment.bookingId);
      if (!booking) continue;
      items.push({
        id: `payment-${payment.id}`,
        type: "payment",
        text: `${booking.customerName} paid ${formatRupiah(payment.amount)}`,
        timestamp: payment.createdAt,
      });
    }

    for (const expense of expenses) {
      items.push({
        id: `expense-${expense.id}`,
        type: "expense",
        text: `Expense: ${expense.category}${expense.vendor ? ` (${expense.vendor})` : ""} — ${formatRupiah(expense.amount)}`,
        timestamp: expense.createdAt,
      });
    }

    items.sort((a, b) => b.timestamp - a.timestamp);
    return items.slice(0, 30);
  }, [customers, enrichedBookings, payments, expenses]);

  const reportData = useMemo(() => {
    return {
      monthlyRevenue: getMonthlyRealizedRevenue(payments, selectedYear),
      monthlyExpenses: getMonthlyExpenses(expenses, selectedYear),
      revenueByService: getRevenueByService(bookings, services, payments),
      revenueByCustomer: getRevenueByCustomer(bookings, customers, payments),
      revenueByPaymentMethod: getRevenueByPaymentMethod(payments),
      outstandingBookings: enrichedBookings.filter(
        (booking) => booking.bookingStatus !== "Cancelled" && booking.remainingAmount > 0,
      ),
    };
  }, [payments, expenses, selectedYear, bookings, services, customers, enrichedBookings]);

  return {
    metrics,
    todaysSchedule,
    upcomingBookings,
    revenueSeries,
    revenueLabels,
    statusCounts,
    revenueByCategory,
    expenseByCategory,
    recentCustomers,
    activityFeed,
    reportData,
  };
}
