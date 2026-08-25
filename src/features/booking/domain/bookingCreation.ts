import { bookingSchema, bookingRecordSchema } from "@/features/booking/schema";
import type { Booking, CreateBookingCommand } from "@/features/booking/types";
import { buildBookingSessions } from "@/features/booking/utils/bookingSessions";
import { initialPaymentSchemaForBooking, paymentRecordSchema } from "@/features/payment/schema";
import type { Payment } from "@/features/payment/types";
import { prepareBookingAdditionalCharges } from "@/features/booking/domain/bookingAdditionalCharges";
import { bookingClientTotal } from "@/features/booking/domain/bookingFinancials";

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

  const sessions = buildBookingSessions(ids.bookingId, bookingInput.sessions, timezone, [], now);
  const booking: Booking = bookingRecordSchema.parse({
    id: ids.bookingId,
    createdAt: now,
    updatedAt: now,
    customerId: bookingInput.customerId,
    serviceId: bookingInput.serviceId,
    sessions,
    servicePrice: bookingInput.servicePrice,
    serviceSnapshot: bookingInput.serviceSnapshot ?? null,
    additionalCharges: prepareBookingAdditionalCharges(ids.bookingId, command.additionalCharges ?? [], sessions, [], now),
    questionnaireResponses: bookingInput.questionnaireResponses,
    capacitySourceRequestId: bookingInput.capacitySourceRequestId,
    capacitySlotKeys: bookingInput.capacitySlotKeys,
    bookingStatus: bookingInput.bookingStatus,
    fullPaymentDueDate: bookingInput.fullPaymentDueDate,
    notes: bookingInput.notes,
  });

  let initialPayment: Payment | null = null;
  if (command.initialPayment) {
    if (!ids.paymentId) throw new Error("Initial payment ID is required.");
    const paymentInput = initialPaymentSchemaForBooking(bookingClientTotal(booking)).parse(command.initialPayment);
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
