import type { PaymentMethod } from "@/features/payment/types";

export type { PaymentMethod };

export type ExpenseCategory =
  | "Transportation"
  | "Accommodation"
  | "Studio"
  | "Assistant"
  | "Equipment"
  | "Makeup Product"
  | "Hair Product"
  | "Accessory"
  | "Marketing"
  | "Food"
  | "Internet"
  | "Utilities"
  | "Office"
  | "Other";

export type ExpenseType = "Booking Expense" | "Business Expense";

export type Expense = {
  id: string;
  date: string;
  category: ExpenseCategory;
  amount: number;
  paymentMethod: PaymentMethod;
  expenseType: ExpenseType;
  /** null when expenseType === "Business Expense" */
  bookingId: string | null;
  vendor: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
};

export type CreateExpenseInput = {
  date: string;
  category: ExpenseCategory;
  amount: number;
  paymentMethod: PaymentMethod;
  expenseType: ExpenseType;
  bookingId: string | null;
  vendor: string;
  notes: string;
};

export type UpdateExpenseInput = CreateExpenseInput & { id: string };
