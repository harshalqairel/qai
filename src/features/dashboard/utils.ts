import { formatBookingTimeRange } from "@/features/booking/utils/bookingDateRange";

export function formatDashboardDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
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
