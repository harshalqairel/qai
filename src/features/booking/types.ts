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

export type Booking = {
  id: string;
  customerId: string;
  serviceId: string;
  sessions: BookingSession[];
  servicePrice: number;
  additionalCharges?: BookingAdditionalCharge[];
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
  bookingStatus: BookingStatus;
  fullPaymentDueDate: string;
  notes: string;
};

export type CreateBookingCommand = {
  requestId: string;
  booking: CreateBookingInput;
  initialPayment: import("@/features/payment/types").InitialPaymentInput | null;
};

export type UpdateBookingInput = CreateBookingInput & {
  id: string;
};

export type BookingFormValues = CreateBookingInput;
