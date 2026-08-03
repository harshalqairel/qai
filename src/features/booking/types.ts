export type BookingStatus = "Scheduled" | "Completed" | "Cancelled";

export type Booking = {
  id: string;
  customerId: string;
  serviceId: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  location: string;
  servicePrice: number;
  bookingStatus: BookingStatus;
  fullPaymentDueDate: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
};

export type CreateBookingInput = {
  customerId: string;
  serviceId: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  location: string;
  servicePrice: number;
  bookingStatus: BookingStatus;
  fullPaymentDueDate: string;
  notes: string;
};

export type UpdateBookingInput = CreateBookingInput & {
  id: string;
};

export type BookingFormValues = CreateBookingInput;
