"use client";

import { useMemo } from "react";
import type { Booking } from "@/features/booking/types";
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
  bookingOverlapsWindow,
  compareByBookingStartDateTime,
  getBookingDateRange,
} from "@/features/booking/utils/bookingDateRange";
import type { ExpenseCategoryItem } from "@/features/expense/utils/expenseAggregations";
import { useExpenseCategories } from "@/features/expense-category/hooks/useExpenseCategories";

export type KPITone = "received" | "unpaid" | "expenses" | "profit";

export type KPI = {
  label: "Money Received" | "Unpaid Amount" | "Expenses" | "Profit";
  value: number;
  period: string;
  tone: KPITone;
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
  serviceName: string;
  totalPaid: number;
  remainingAmount: number;
  paymentStatus: "Outstanding" | "Partial Paid" | "Fully Paid" | "Cancelled";
};

export type SetupGuideProgress = {
  serviceCategoriesComplete: boolean;
  expenseCategoriesComplete: boolean;
  servicesComplete: boolean;
  customerAndBookingComplete: boolean;
};

type UseDashboardArgs = {
  selectedYear: number;
};

export function useDashboard({ selectedYear }: UseDashboardArgs) {
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

  const todayContext = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    return { now, todayKey, startOfToday, endOfToday };
  }, []);

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
        customerName: customer?.name ?? "Customer not found",
        serviceName: service?.name ?? "Service not found",
        totalPaid: paymentSummary?.totalPaid ?? 0,
        remainingAmount: paymentSummary?.remainingAmount ?? effectiveServicePrice,
        paymentStatus: paymentSummary?.paymentStatus ?? "Outstanding",
      };
    });
  }, [bookings, customers, services, paymentSummaries]);

  const todaysSchedule = useMemo(() => {
    return enrichedBookings
      .filter((booking) =>
        bookingOverlapsWindow(
          {
            bookingDate: booking.bookingDate,
            startTime: booking.startTime,
            endTime: booking.endTime,
          },
          todayContext.startOfToday,
          todayContext.endOfToday,
        ))
      .sort(compareByBookingStartDateTime);
  }, [enrichedBookings, todayContext]);

  const upcomingJobs = useMemo(() => {
    return enrichedBookings
      .filter((booking) => {
        if (booking.bookingStatus === "Cancelled") return false;
        const range = getBookingDateRange({
          bookingDate: booking.bookingDate,
          startTime: booking.startTime,
          endTime: booking.endTime,
        });
        if (!range) return false;
        return range.start > todayContext.now;
      })
      .sort(compareByBookingStartDateTime)
      .slice(0, 6);
  }, [enrichedBookings, todayContext.now]);

  const paymentsDueSoon = useMemo(() => {
    return enrichedBookings
      .filter(
        (booking) =>
          booking.bookingStatus !== "Cancelled" &&
          booking.remainingAmount > 0 &&
          booking.fullPaymentDueDate >= todayContext.todayKey,
      )
      .sort((a, b) => a.fullPaymentDueDate.localeCompare(b.fullPaymentDueDate))
      .slice(0, 6);
  }, [enrichedBookings, todayContext.todayKey]);

  const latePayments = useMemo(() => {
    return enrichedBookings
      .filter(
        (booking) =>
          booking.bookingStatus !== "Cancelled" &&
          booking.remainingAmount > 0 &&
          booking.fullPaymentDueDate < todayContext.todayKey,
      )
      .sort((a, b) => a.fullPaymentDueDate.localeCompare(b.fullPaymentDueDate))
      .slice(0, 6);
  }, [enrichedBookings, todayContext.todayKey]);

  const statusCounts = useMemo<Record<Booking["bookingStatus"], number>>(() => {
    const counts = { Scheduled: 0, Completed: 0, Cancelled: 0 };
    for (const booking of bookings) {
      counts[booking.bookingStatus] += 1;
    }
    return counts;
  }, [bookings]);

  const thisYearRealized = useMemo(() => {
    return validPayments.reduce((sum, payment) => {
      const date = new Date(`${payment.date}T00:00:00`);
      return date.getFullYear() === selectedYear ? sum + payment.amount : sum;
    }, 0);
  }, [validPayments, selectedYear]);

  const thisYearExpenses = useMemo(() => {
    return validExpenses.reduce((sum, expense) => {
      const date = new Date(`${expense.date}T00:00:00`);
      return date.getFullYear() === selectedYear ? sum + expense.amount : sum;
    }, 0);
  }, [validExpenses, selectedYear]);

  const thisYearNet = thisYearRealized - thisYearExpenses;

  const thisYearPotential = useMemo(() => {
    return enrichedBookings.reduce((sum, booking) => {
      if (booking.bookingStatus === "Cancelled") return sum;
      const range = getBookingDateRange({
        bookingDate: booking.bookingDate,
        startTime: booking.startTime,
        endTime: booking.endTime,
      });
      const year = range?.start.getFullYear();
      if (year !== selectedYear) return sum;
      return sum + Math.max(booking.remainingAmount, 0);
    }, 0);
  }, [enrichedBookings, selectedYear]);

  const metrics = useMemo<KPI[]>(
    () => [
      {
        label: "Money Received",
        value: thisYearRealized,
        period: String(selectedYear),
        tone: "received",
      },
      {
        label: "Unpaid Amount",
        value: thisYearPotential,
        period: String(selectedYear),
        tone: "unpaid",
      },
      {
        label: "Expenses",
        value: thisYearExpenses,
        period: String(selectedYear),
        tone: "expenses",
      },
      {
        label: "Profit",
        value: thisYearNet,
        period: String(selectedYear),
        tone: "profit",
      },
    ],
    [selectedYear, thisYearRealized, thisYearPotential, thisYearExpenses, thisYearNet],
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
    const byCategory = getRevenueByCategory(bookings, services, serviceCategories, validPayments)
      .filter((item) => item.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);
    const totalRevenue = byCategory.reduce((sum, item) => sum + item.revenue, 0);

    return byCategory.map((item) => ({
      ...item,
      percentage: totalRevenue > 0 ? Math.round((item.revenue / totalRevenue) * 100) : 0,
    }));
  }, [bookings, services, serviceCategories, validPayments]);

  const expenseByCategory = useMemo<ExpenseCategoryItem[]>(
    () => getExpensesByCategory(validExpenses, expenseCategories),
    [validExpenses, expenseCategories],
  );

  const setupGuideProgress = useMemo<SetupGuideProgress>(() => ({
    serviceCategoriesComplete: serviceCategories.some((category) => category.active),
    expenseCategoriesComplete: expenseCategories.some((category) => category.active),
    servicesComplete: services.some((service) => service.active),
    customerAndBookingComplete: customers.length > 0 && bookings.length > 0,
  }), [serviceCategories, expenseCategories, services, customers, bookings]);

  const showSetupGuide = bookings.length === 0 && payments.length === 0 && expenses.length === 0;

  return {
    metrics,
    todaysSchedule,
    paymentsDueSoon,
    upcomingJobs,
    latePayments,
    statusCounts,
    revenueSeries,
    incomeByCategory,
    expenseByCategory,
    showSetupGuide,
    setupGuideProgress,
    isLoading: bookingData.isLoading || customerData.isLoading || serviceData.isLoading || serviceCategoryData.isLoading || paymentData.isLoading || expenseData.isLoading || expenseCategoryData.isLoading,
    loadError: bookingData.loadError || customerData.loadError || serviceData.loadError || serviceCategoryData.loadError || paymentData.loadError || expenseData.loadError || expenseCategoryData.loadError,
    hasData: bookings.length > 0 || validPayments.length > 0 || validExpenses.length > 0,
    retry: () => {
      bookingData.retry(); customerData.retry(); serviceData.retry(); serviceCategoryData.retry();
      paymentData.retry(); expenseData.retry(); expenseCategoryData.retry();
    },
  };
}
