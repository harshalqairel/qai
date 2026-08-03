import { z } from "zod";
import { PAYMENT_METHODS } from "./constants";

export const paymentSchema = z.object({
  bookingId: z.string().min(1, "Booking is required."),
  date: z.string().min(1, "Payment date is required."),
  amount: z.coerce.number().positive("Amount must be greater than 0."),
  method: z.enum(PAYMENT_METHODS),
  notes: z.string().trim().or(z.literal("")),
});

export type PaymentFormValues = z.infer<typeof paymentSchema>;
