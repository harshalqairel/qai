export type PaymentMethod =
  | "Cash"
  | "Transfer"
  | "QRIS"
  | "Credit Card"
  | "Other";

export type Payment = {
  id: string;
  bookingId: string;
  date: string;
  amount: number;
  method: PaymentMethod;
  notes: string;
  createdAt: number;
};

export type CreatePaymentInput = {
  bookingId: string;
  date: string;
  amount: number;
  method: PaymentMethod;
  notes: string;
};

export type UpdatePaymentInput = CreatePaymentInput & {
  id: string;
};

export type DerivedPaymentStatus =
  | "Outstanding"
  | "Partial Paid"
  | "Fully Paid"
  | "Cancelled";
