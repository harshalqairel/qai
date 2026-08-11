import { formatBookingTimeRange } from "@/features/booking/utils/bookingDateRange";

export function formatDashboardDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

export function formatBookingTime(
  bookingDate: string | null | undefined,
  startTime: string | null | undefined,
  endTime: string | null | undefined,
): string {
  return formatBookingTimeRange(bookingDate, startTime, endTime);
}

export function getOverdueAgeDays(dueDate: string, todayDate: string): number {
  return Math.max(0, Math.round((Date.parse(`${todayDate}T00:00:00Z`) - Date.parse(`${dueDate}T00:00:00Z`)) / 86_400_000));
}
