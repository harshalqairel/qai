import type { Booking } from "@/features/booking/types";
import type { Customer } from "@/features/customer/types";
import type { ExpenseCategory } from "@/features/expense-category/types";
import type { Expense } from "@/features/expense/types";
import type { Payment } from "@/features/payment/types";
import type { ServiceCategory } from "@/features/service-category/types";
import type { Service } from "@/features/service/types";
import type { AdditionalChargeCategory } from "@/features/booking/domain/additionalChargeCategories";

export const QAI_BACKUP_APP = "Qai";
export const QAI_BACKUP_VERSION = 2;

// Keep this conservative for the MVP to avoid large-memory parsing spikes in the browser.
export const MAX_BACKUP_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export type QaiBackupData = {
  customers: Customer[];
  services: Service[];
  bookings: Booking[];
  payments: Payment[];
  expenses: Expense[];
  serviceCategories: ServiceCategory[];
  expenseCategories: ExpenseCategory[];
  additionalChargeCategories?: AdditionalChargeCategory[];
  settings?: Record<string, unknown>;
};

export type QaiBackupFile = {
  app: typeof QAI_BACKUP_APP;
  backupVersion: typeof QAI_BACKUP_VERSION;
  createdAt: string;
  data: QaiBackupData;
};

export type BackupValidationErrorCode =
  | "INVALID_FILE"
  | "UNSUPPORTED_VERSION"
  | "INCOMPLETE_RECORDS"
  | "BROKEN_LINKS"
  | "FILE_TOO_LARGE";
