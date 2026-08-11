import { z } from "zod";
import { PAYMENT_METHODS } from "./constants";
import { storedDateSchema, storedTimestampSchema } from "@/lib/persistence";

export const paymentSchema = z.object({
  bookingId: z.string().min(1, "Booking is required."),
  date: z
    .string()
    .min(1, "Payment date is required.")
    .refine((value) => storedDateSchema.safeParse(value).success, "Enter a valid payment date."),
  amount: z.coerce.number().positive("Amount must be greater than 0."),
  method: z.enum(PAYMENT_METHODS),
  notes: z.string().trim().or(z.literal("")),
});

export const initialPaymentSchema = paymentSchema.omit({ bookingId: true });

export function initialPaymentSchemaForBooking(bookingPrice: number) {
  return initialPaymentSchema.superRefine((payment, context) => {
    if (!Number.isFinite(bookingPrice) || bookingPrice < 0) {
      context.addIssue({
        code: "custom",
        path: ["amount"],
        message: "Enter a valid booking price before adding a payment.",
      });
      return;
    }
    if (payment.amount > bookingPrice) {
      context.addIssue({
        code: "custom",
        path: ["amount"],
        message: `Amount cannot exceed the booking price of ${bookingPrice.toLocaleString("id-ID")}.`,
      });
    }
  });
}

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
