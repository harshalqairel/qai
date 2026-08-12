"use client";

import { useEffect, useMemo, useState } from "react";
import type { Booking, BookingSession } from "@/features/booking/types";
import { useBookings } from "@/features/booking/hooks/useBookings";
import { useCustomers } from "@/features/customer/hooks/useCustomers";
import { useServices } from "@/features/service/hooks/useServices";
import { useServiceCategories } from "@/features/service-category/hooks/useServiceCategories";
import { usePayments } from "@/features/payment/hooks/usePayments";
import { useExpenses } from "@/features/expense/hooks/useExpenses";
import { summarizeBookingPayments } from "@/features/payment/utils/paymentCalculations";
import { partitionPaymentsByBookingIntegrity } from "@/features/payment/utils/paymentIntegrity";
import {
  getMonthlyRealizedRevenue,
  getRevenueByCategory,
} from "@/features/payment/utils/reportAggregations";
import {
  getMonthlyExpenses,
  getExpensesByCategory,
} from "@/features/expense/utils/expenseAggregations";
import { partitionExpensesByBookingIntegrity } from "@/features/expense/utils/expenseIntegrity";
import {
  instantParts,
  zonedDateTimeToIso,
} from "@/features/booking/utils/bookingSessions";
import type { ExpenseCategoryItem } from "@/features/expense/utils/expenseAggregations";
import { useExpenseCategories } from "@/features/expense-category/hooks/useExpenseCategories";
import {
  buildFinancialReport,
  dateIsInReportPeriod,
  type ReportPeriodInput,
} from "@/features/reports/financialReport";
import { isPaymentReminderEligible } from "@/features/reminder/reminderTransport";
import { getActiveBusinessContext } from "@/lib/supabase/cloudRepositories";
import { isCloudModeEnabled, isValidationModeEnabled } from "@/lib/supabase/config";

export type KPITone = "received" | "unpaid" | "expenses" | "profit";

export type KPI = {
  label: "Income" | "Unpaid amount" | "Expenses" | "Profit";
  value: number;
  period: string;
  tone: KPITone;
  description: string;
};

export type RevenuePoint = {
  label: string;
  realized: number;
  expenses: number;
  net: number;
};

export type IncomeByCategoryItem = {
  categoryId: string;
  categoryName: string;
  categoryColor?: string;
  revenue: number;
  percentage: number;
};

export type EnrichedBooking = Booking & {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  serviceName: string;
  totalPaid: number;
  remainingAmount: number;
  paymentStatus: "Outstanding" | "Partial Paid" | "Fully Paid" | "Cancelled";
};

export type ScheduledSessionItem = EnrichedBooking & {
  session: BookingSession;
};

export type SetupGuideProgress = {
  servicesComplete: boolean;
  customersComplete: boolean;
  bookingsComplete: boolean;
  paymentsComplete: boolean;
};

type UseDashboardArgs = {
  period: ReportPeriodInput;
};

export function useDashboard({ period }: UseDashboardArgs) {
  const [businessName, setBusinessName] = useState("Qai Business");
  const bookingData = useBookings();
  const customerData = useCustomers();
  const serviceData = useServices();
  const serviceCategoryData = useServiceCategories();
  const paymentData = usePayments();
  const expenseData = useExpenses();
  const expenseCategoryData = useExpenseCategories();
  const { bookings } = bookingData;
  const { customers } = customerData;
  const { services } = serviceData;
  const { categories: serviceCategories } = serviceCategoryData;
  const { payments } = paymentData;
  const { expenses } = expenseData;
  const { categories: expenseCategories } = expenseCategoryData;
  const selectedYear = new Date().getFullYear();

  useEffect(() => {
    if (isValidationModeEnabled()) { const timer = window.setTimeout(() => { try { const metadata = JSON.parse(window.localStorage.getItem("qai:validation-workspace") ?? "null") as { label?: string } | null; if (metadata?.label) setBusinessName(metadata.label); } catch { /* Keep fallback. */ } }, 0); return () => window.clearTimeout(timer); }
    if (!isCloudModeEnabled()) return;
    let active = true;
    void getActiveBusinessContext().then((context) => {
      if (active) setBusinessName(context.businessName);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const todayContext = useMemo(() => {
    const now = new Date();
    const todayKey = instantParts(now.toISOString(), bookingData.timezone).date;
    const tomorrow = new Date(`${todayKey}T00:00:00.000Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const startOfToday = new Date(zonedDateTimeToIso(todayKey, "00:00", bookingData.timezone));
    const endOfToday = new Date(zonedDateTimeToIso(tomorrow.toISOString().slice(0, 10), "00:00", bookingData.timezone));
    return { now, todayKey, startOfToday, endOfToday };
  }, [bookingData.timezone]);

  const { validPayments } = useMemo(
    () => partitionPaymentsByBookingIntegrity(payments, bookings),
    [payments, bookings],
  );

  const { validExpenses } = useMemo(
    () => partitionExpensesByBookingIntegrity(expenses, bookings),
    [expenses, bookings],
  );

  const paymentSummaries = useMemo(
    () => summarizeBookingPayments(bookings, validPayments),
    [bookings, validPayments],
  );

  const enrichedBookings = useMemo<EnrichedBooking[]>(() => {
    return bookings.map((booking) => {
      const customer = customers.find((item) => item.id === booking.customerId);
      const service = services.find((item) => item.id === booking.serviceId);
      const effectiveServicePrice = booking.servicePrice > 0
        ? booking.servicePrice
        : service?.price ?? 0;
      const paymentSummary = paymentSummaries[booking.id];

      return {
        ...booking,
        servicePrice: effectiveServicePrice,
        customerName: customer?.name ?? "Client not found",
        customerPhone: customer?.phone ?? "",
        customerEmail: customer?.email ?? "",
        serviceName: service?.name ?? "Service not found",
        totalPaid: paymentSummary?.totalPaid ?? 0,
        remainingAmount: paymentSummary?.remainingAmount ?? effectiveServicePrice,
        paymentStatus: paymentSummary?.paymentStatus ?? "Outstanding",
      };
    });
  }, [bookings, customers, services, paymentSummaries]);

  const todaysSchedule = useMemo(() => {
    return enrichedBookings
      .filter((booking) => booking.bookingStatus !== "Cancelled")
      .flatMap((booking) => booking.sessions
        .filter((session) =>
          Date.parse(session.startAt) < todayContext.endOfToday.getTime() &&
          Date.parse(session.endAt) > todayContext.startOfToday.getTime())
        .map((session): ScheduledSessionItem => ({ ...booking, session })))
      .sort((left, right) => left.session.startAt.localeCompare(right.session.startAt));
  }, [enrichedBookings, todayContext]);

  const upcomingJobs = useMemo(() => {
    return enrichedBookings
      .filter((booking) => booking.bookingStatus !== "Cancelled")
      .flatMap((booking) => booking.sessions
        .filter((session) => Date.parse(session.startAt) > todayContext.now.getTime())
        .map((session): ScheduledSessionItem => ({ ...booking, session })))
      .sort((left, right) => left.session.startAt.localeCompare(right.session.startAt))
      .slice(0, 6);
  }, [enrichedBookings, todayContext.now]);

  const allPaymentsDueSoon = useMemo(() => {
    return enrichedBookings
      .filter(
        (booking) =>
          isPaymentReminderEligible(booking) &&
          booking.fullPaymentDueDate >= todayContext.todayKey,
      )
      .sort((a, b) => a.fullPaymentDueDate.localeCompare(b.fullPaymentDueDate));
  }, [enrichedBookings, todayContext.todayKey]);

  const allLatePayments = useMemo(() => {
    return enrichedBookings
      .filter(
        (booking) =>
          isPaymentReminderEligible(booking) &&
          booking.fullPaymentDueDate < todayContext.todayKey,
      )
      .sort((a, b) => a.fullPaymentDueDate.localeCompare(b.fullPaymentDueDate));
  }, [enrichedBookings, todayContext.todayKey]);

  const paymentsDueSoon = allPaymentsDueSoon.slice(0, 6);
  const latePayments = allLatePayments.slice(0, 6);

  const statusCounts = useMemo<Record<Booking["bookingStatus"], number>>(() => {
    const counts = { Scheduled: 0, Completed: 0, Cancelled: 0 };
    for (const booking of bookings) {
      counts[booking.bookingStatus] += 1;
    }
    return counts;
  }, [bookings]);

  const financialReport = useMemo(() => buildFinancialReport({
    businessName,
    currency: "IDR",
    timezone: bookingData.timezone,
    period,
    bookings,
    customers,
    services,
    payments: validPayments,
    expenses: validExpenses,
    expenseCategories,
  }), [businessName, period, bookingData.timezone, bookings, customers, services, validPayments, validExpenses, expenseCategories]);

  const metrics = useMemo<KPI[]>(
    () => [
      {
        label: "Income",
        value: financialReport.summary.moneyReceived,
        period: financialReport.period.label,
        tone: "received",
        description: "Payments actually recorded during this period.",
      },
      {
        label: "Unpaid amount",
        value: financialReport.summary.outstanding,
        period: financialReport.period.label,
        tone: "unpaid",
        description: "Balances still due on active bookings.",
      },
      {
        label: "Expenses",
        value: financialReport.summary.expenses,
        period: financialReport.period.label,
        tone: "expenses",
        description: "Business and booking expenses in this period.",
      },
      {
        label: "Profit",
        value: financialReport.summary.realizedProfit,
        period: financialReport.period.label,
        tone: "profit",
        description: "Money received minus expenses in this period.",
      },
    ],
    [financialReport],
  );

  const revenueSeries = useMemo<RevenuePoint[]>(() => {
    const realizedMonthly = getMonthlyRealizedRevenue(validPayments, selectedYear);
    const expensesMonthly = getMonthlyExpenses(validExpenses, selectedYear);

    return realizedMonthly.map((realized, index) => ({
      label: new Date(selectedYear, index, 1).toLocaleString("en-US", {
        month: "long",
      }),
      realized,
      expenses: expensesMonthly[index],
      net: realized - expensesMonthly[index],
    }));
  }, [validPayments, validExpenses, selectedYear]);

  const incomeByCategory = useMemo<IncomeByCategoryItem[]>(() => {
    const periodPayments = validPayments.filter((payment) => dateIsInReportPeriod(payment.date, financialReport.period));
    const byCategory = getRevenueByCategory(bookings, services, serviceCategories, periodPayments)
      .filter((item) => item.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);
    const totalRevenue = byCategory.reduce((sum, item) => sum + item.revenue, 0);

    return byCategory.map((item) => ({
      ...item,
      percentage: totalRevenue > 0 ? Math.round((item.revenue / totalRevenue) * 100) : 0,
    }));
  }, [bookings, services, serviceCategories, validPayments, financialReport.period]);

  const expenseByCategory = useMemo<ExpenseCategoryItem[]>(
    () => getExpensesByCategory(
      validExpenses.filter((expense) => dateIsInReportPeriod(expense.date, financialReport.period)),
      expenseCategories,
    ),
    [validExpenses, expenseCategories, financialReport.period],
  );

  const setupGuideProgress = useMemo<SetupGuideProgress>(() => ({
    servicesComplete: services.some((service) => service.active),
    customersComplete: customers.length > 0,
    bookingsComplete: bookings.length > 0,
    paymentsComplete: validPayments.length > 0,
  }), [services, customers, bookings, validPayments]);

  const showSetupGuide = !setupGuideProgress.servicesComplete || !setupGuideProgress.customersComplete || !setupGuideProgress.bookingsComplete || !setupGuideProgress.paymentsComplete;

  return {
    metrics,
    todaysSchedule,
    paymentsDueSoon,
    paymentsDueSoonCount: allPaymentsDueSoon.length,
    upcomingJobs,
    latePayments,
    latePaymentsCount: allLatePayments.length,
    statusCounts,
    revenueSeries,
    incomeByCategory,
    expenseByCategory,
    financialReport,
    currentMonth: todayContext.todayKey.slice(0, 7),
    todayKey: todayContext.todayKey,
    businessName,
    showSetupGuide,
    setupGuideProgress,
    timezone: bookingData.timezone,
    isLoading: bookingData.isLoading || customerData.isLoading || serviceData.isLoading || serviceCategoryData.isLoading || paymentData.isLoading || expenseData.isLoading || expenseCategoryData.isLoading,
    loadError: bookingData.loadError || customerData.loadError || serviceData.loadError || serviceCategoryData.loadError || paymentData.loadError || expenseData.loadError || expenseCategoryData.loadError,
    hasData: bookings.length > 0 || validPayments.length > 0 || validExpenses.length > 0,
    retry: () => {
      bookingData.retry(); customerData.retry(); serviceData.retry(); serviceCategoryData.retry();
      paymentData.retry(); expenseData.retry(); expenseCategoryData.retry();
    },
  };
}
