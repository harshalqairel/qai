import { Booking } from "@/features/booking/types";

export type CalendarView = "month" | "week" | "day" | "agenda";

export type CalendarBooking = Booking & {
  customerName: string;
  serviceName: string;
};
