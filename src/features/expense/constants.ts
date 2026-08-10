export const EXPENSE_STORAGE_KEY = "qai:expenses";
export const EXPENSE_STORAGE_VERSION = 3;
export const EXPENSE_CATEGORY_STORAGE_KEY = "qai:expense-categories";

export const DEFAULT_EXPENSE_CATEGORY_NAMES = [
  "Transportation",
  "Accommodation",
  "Studio",
  "Assistant",
  "Equipment",
  "Makeup Product",
  "Hair Product",
  "Accessory",
  "Marketing",
  "Food",
  "Internet",
  "Utilities",
  "Office",
  "Other",
] as const;

export const EXPENSE_TYPES = [
  "Booking Expense",
  "Business Expense",
] as const;
