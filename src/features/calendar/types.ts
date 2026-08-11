import { Booking, BookingSession } from "@/features/booking/types";

export type CalendarView = "month" | "week" | "day" | "agenda";

export type CalendarBooking = Booking & {
  customerName: string;
  serviceName: string;
  categoryColor: string;
  session: BookingSession;
  bookingDate: string;
  startTime: string;
  endTime: string;
  location: string;
};
