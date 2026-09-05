import type { Booking } from "@/features/booking/types";
import { calculateBookingFinancials } from "@/features/booking/domain/bookingFinancials";
import type { Expense } from "@/features/expense/types";
import type { Payment } from "@/features/payment/types";
import type { FinancialReport } from "@/features/reports/financialReport";
import { nextDateKey } from "@/features/reports/financialReport";

export type FinancialReportInsights = {
  averageBookingValue: number;
  financiallyActiveBookings: number;
  topService: FinancialReport["topServices"][number] | null;
  busiestScheduleDay: { label: string; schedules: number } | null;
  upcomingPayments: { amount: number; bookings: number; throughDate: string };
};

export function buildFinancialReportInsights(args: {
  report: FinancialReport;
  bookings: readonly Booking[];
  payments: readonly Payment[];
  expenses: readonly Expense[];
  todayKey: string;
  upcomingDays?: number;
}): FinancialReportInsights {
  const activeRows = args.report.bookings.filter((booking) => booking.status !== "Cancelled");
  const activeValue = activeRows.reduce((sum, booking) => sum + booking.bookingValue, 0);

  const dayCounts = new Map<number, number>();
  for (const schedule of args.report.schedule) {
    const day = new Date(`${schedule.date}T00:00:00.000Z`).getUTCDay();
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
  }
  const busiestEntry = [...dayCounts].sort((left, right) => right[1] - left[1] || left[0] - right[0])[0];
  const dayLabel = busiestEntry ? new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 7, 2 + busiestEntry[0]))) : "";

  const upcomingDays = args.upcomingDays ?? 7;
  let throughDate = args.todayKey;
  for (let day = 0; day < upcomingDays; day += 1) throughDate = nextDateKey(throughDate);
  const upcoming = args.bookings
    .filter((booking) => booking.bookingStatus !== "Cancelled" && booking.fullPaymentDueDate >= args.todayKey && booking.fullPaymentDueDate <= throughDate)
    .map((booking) => calculateBookingFinancials(booking, args.payments, args.expenses))
    .filter((financials) => (financials.outstanding ?? 0) > 0);

  return {
    averageBookingValue: activeRows.length ? activeValue / activeRows.length : 0,
    financiallyActiveBookings: activeRows.length,
    topService: args.report.topServices[0] ?? null,
    busiestScheduleDay: busiestEntry ? { label: dayLabel, schedules: busiestEntry[1] } : null,
    upcomingPayments: {
      amount: upcoming.reduce((sum, item) => sum + (item.outstanding ?? 0), 0),
      bookings: upcoming.length,
      throughDate,
    },
  };
}
