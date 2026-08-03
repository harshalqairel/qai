import { z } from "zod";
import { PAYMENT_METHODS } from "./constants";
import { storedDateSchema, storedTimestampSchema } from "@/lib/persistence";

export const paymentSchema = z.object({
  bookingId: z.string().min(1, "Booking is required."),
  date: z.string().min(1, "Payment date is required."),
  amount: z.coerce.number().positive("Amount must be greater than 0."),
  method: z.enum(PAYMENT_METHODS),
  notes: z.string().trim().or(z.literal("")),
});

export type PaymentFormValues = z.infer<typeof paymentSchema>;

export const paymentRecordSchema = z
  .object({
    id: z.string().min(1),
    bookingId: z.string().min(1),
    date: storedDateSchema,
    amount: z.number().finite().positive(),
    method: z.enum(PAYMENT_METHODS),
    notes: z.string(),
    createdAt: storedTimestampSchema,
  })
  .passthrough();
