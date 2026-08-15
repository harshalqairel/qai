import { bookingSchema, bookingRecordSchema } from "@/features/booking/schema";
import type { Booking, CreateBookingCommand } from "@/features/booking/types";
import { buildBookingSessions } from "@/features/booking/utils/bookingSessions";
import { initialPaymentSchemaForBooking, paymentRecordSchema } from "@/features/payment/schema";
import type { Payment } from "@/features/payment/types";

export type BookingCreationIds = {
  bookingId: string;
  paymentId: string | null;
};

export type PreparedBookingCreation = {
  requestId: string;
  booking: Booking;
  initialPayment: Payment | null;
};

export function prepareBookingCreation(
  command: CreateBookingCommand,
  timezone: string,
  ids: BookingCreationIds,
  now = Date.now(),
): PreparedBookingCreation {
  const bookingInput = bookingSchema.parse(command.booking);
  if (!command.requestId.trim()) throw new Error("Booking creation request ID is required.");
  if (command.initialPayment && bookingInput.bookingStatus === "Cancelled") {
    throw new Error("Initial payment cannot be added to a cancelled booking.");
  }

  const booking: Booking = bookingRecordSchema.parse({
    id: ids.bookingId,
    createdAt: now,
    updatedAt: now,
    customerId: bookingInput.customerId,
    serviceId: bookingInput.serviceId,
    sessions: buildBookingSessions(ids.bookingId, bookingInput.sessions, timezone, [], now),
    servicePrice: bookingInput.servicePrice,
    additionalCharges: [],
    bookingStatus: bookingInput.bookingStatus,
    fullPaymentDueDate: bookingInput.fullPaymentDueDate,
    notes: bookingInput.notes,
  });

  let initialPayment: Payment | null = null;
  if (command.initialPayment) {
    if (!ids.paymentId) throw new Error("Initial payment ID is required.");
    const paymentInput = initialPaymentSchemaForBooking(booking.servicePrice).parse(command.initialPayment);
    initialPayment = paymentRecordSchema.parse({
      id: ids.paymentId,
      bookingId: booking.id,
      createdAt: now,
      ...paymentInput,
    });
  }

  return {
    requestId: command.requestId,
    booking,
    initialPayment,
  };
}
