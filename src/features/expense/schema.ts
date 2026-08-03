import { z } from "zod";
import { EXPENSE_CATEGORIES, EXPENSE_TYPES } from "./constants";
import { PAYMENT_METHODS } from "@/features/payment/constants";

export const expenseSchema = z
  .object({
    date: z.string().min(1, "Date is required."),
    category: z.enum(EXPENSE_CATEGORIES),
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
