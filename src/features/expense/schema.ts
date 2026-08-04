import { z } from "zod";
import { EXPENSE_TYPES } from "./constants";
import { PAYMENT_METHODS } from "@/features/payment/constants";
import { storedDateSchema, storedTimestampSchema } from "@/lib/persistence";

export const expenseSchema = z
  .object({
    date: z.string().min(1, "Date is required."),
    categoryId: z.string().min(1, "Please choose a category."),
    amount: z.coerce.number().positive("Amount must be greater than 0."),
    paymentMethod: z.enum(PAYMENT_METHODS),
    expenseType: z.enum(EXPENSE_TYPES),
    bookingId: z.string().nullable(),
    vendor: z.string().trim(),
    notes: z.string().trim(),
  })
  .superRefine((data, ctx) => {
    if (data.expenseType === "Booking Expense" && !data.bookingId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Booking is required for a Booking Expense.",
        path: ["bookingId"],
      });
    }
  });

export type ExpenseFormValues = z.infer<typeof expenseSchema>;

export const expenseRecordSchema = z
  .object({
    id: z.string().min(1),
    date: storedDateSchema,
    categoryId: z.string().min(1),
    amount: z.number().finite().positive(),
    paymentMethod: z.enum(PAYMENT_METHODS),
    expenseType: z.enum(EXPENSE_TYPES),
    bookingId: z.string().min(1).nullable(),
    vendor: z.string(),
    notes: z.string(),
    createdAt: storedTimestampSchema,
    updatedAt: storedTimestampSchema,
  })
  .superRefine((data, ctx) => {
    if (data.expenseType === "Booking Expense" && data.bookingId === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Booking expenses require a booking ID.",
        path: ["bookingId"],
      });
    }
    if (data.expenseType === "Business Expense" && data.bookingId !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Business expenses cannot reference a booking.",
        path: ["bookingId"],
      });
    }
  });
