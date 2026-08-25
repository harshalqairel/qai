import type { BookingQuestionResponse } from "@/features/booking-questionnaire/questionnaire";
import type { ServiceSelectionSnapshot } from "@/features/service/types";

export type BookingStatus = "Scheduled" | "Completed" | "Cancelled";

export type BookingSession = {
  id: string;
  bookingId: string;
  sequence: number;
  label: string;
  startAt: string;
  endAt: string;
  location: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
};

export type BookingSessionInput = {
  id?: string;
  label: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  notes: string;
};

export type BookingAdditionalCharge = {
  id: string;
  bookingId: string;
  sessionId: string | null;
  categoryId: string;
  categoryName: string;
  description: string;
  amount: number;
  createdAt: number;
  updatedAt: number;
};

export type BookingAdditionalChargeInput = {
  id?: string;
  sessionId: string | null;
  categoryId: string;
  categoryName: string;
  description: string;
  amount: number;
};

export type Booking = {
  id: string;
  customerId: string;
  serviceId: string;
  sessions: BookingSession[];
  servicePrice: number;
  serviceSnapshot?: ServiceSelectionSnapshot | null;
  additionalCharges?: BookingAdditionalCharge[];
  questionnaireResponses?: BookingQuestionResponse[];
  capacitySourceRequestId?: string | null;
  capacitySlotKeys?: string[];
  bookingStatus: BookingStatus;
  fullPaymentDueDate: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
};

export type CreateBookingInput = {
  customerId: string;
  serviceId: string;
  sessions: BookingSessionInput[];
  servicePrice: number;
  serviceSnapshot?: ServiceSelectionSnapshot | null;
  questionnaireResponses?: BookingQuestionResponse[];
  capacitySourceRequestId?: string | null;
  capacitySlotKeys?: string[];
  bookingStatus: BookingStatus;
  fullPaymentDueDate: string;
  notes: string;
};

export type CreateBookingCommand = {
  requestId: string;
  booking: CreateBookingInput;
  initialPayment: import("@/features/payment/types").InitialPaymentInput | null;
  additionalCharges?: BookingAdditionalChargeInput[];
};

export type UpdateBookingInput = CreateBookingInput & {
  id: string;
  additionalCharges?: BookingAdditionalChargeInput[];
};

export type BookingFormValues = CreateBookingInput;
