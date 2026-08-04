import type { PaymentMethod } from "@/features/payment/types";

export type { PaymentMethod };

export type ExpenseType = "Booking Expense" | "Business Expense";

export type Expense = {
  id: string;
  date: string;
  categoryId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  expenseType: ExpenseType;
  bookingId: string | null;
  vendor: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
};

export type CreateExpenseInput = {
  date: string;
  categoryId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  expenseType: ExpenseType;
  bookingId: string | null;
  vendor: string;
  notes: string;
};

export type UpdateExpenseInput = CreateExpenseInput & { id: string };
