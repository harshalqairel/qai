import { z } from "zod";
import { bookingRepository } from "@/features/booking/api/bookingRepository";
import { bookingRecordSchema } from "@/features/booking/schema";
import { customerRepository } from "@/features/customer/api/customerRepository";
import { customerRecordSchema } from "@/features/customer/schema";
import { expenseCategoryRepository } from "@/features/expense-category/api/expenseCategoryRepository";
import { expenseRepository } from "@/features/expense/api/expenseRepository";
import { expenseRecordSchema } from "@/features/expense/schema";
import { paymentRepository } from "@/features/payment/api/paymentRepository";
import { paymentRecordSchema } from "@/features/payment/schema";
import { serviceCategoryRepository } from "@/features/service-category/api/serviceCategoryRepository";
import { serviceRepository } from "@/features/service/api/serviceRepository";
import { serviceRecordSchema } from "@/features/service/schema";
import { categoryRecordSchema } from "@/features/category/schema";
import {
  MAX_BACKUP_FILE_SIZE_BYTES,
  QAI_BACKUP_APP,
  QAI_BACKUP_VERSION,
  type BackupValidationErrorCode,
  type QaiBackupData,
  type QaiBackupFile,
} from "./types";

type ValidationResult =
  | { ok: true; backup: QaiBackupFile }
  | { ok: false; code: BackupValidationErrorCode };

function duplicateIds(records: readonly { id: string }[]): boolean {
  const ids = new Set<string>();
  for (const record of records) {
    if (ids.has(record.id)) return true;
    ids.add(record.id);
  }
  return false;
}

function toArraySchema<T>(schema: z.ZodType<T>) {
  return z.array(schema);
}

function validateDataSets(data: unknown): ValidationResult {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, code: "INVALID_FILE" };
  }

  const source = data as Record<string, unknown>;
  const customers = toArraySchema(customerRecordSchema).safeParse(source.customers);
  const services = toArraySchema(serviceRecordSchema).safeParse(source.services);
  const bookings = toArraySchema(bookingRecordSchema).safeParse(source.bookings);
  const payments = toArraySchema(paymentRecordSchema).safeParse(source.payments);
  const expenses = toArraySchema(expenseRecordSchema).safeParse(source.expenses);
  const serviceCategories = toArraySchema(categoryRecordSchema).safeParse(source.serviceCategories);
  const expenseCategories = toArraySchema(categoryRecordSchema).safeParse(source.expenseCategories);

  if (
    !customers.success ||
    !services.success ||
    !bookings.success ||
    !payments.success ||
    !expenses.success ||
    !serviceCategories.success ||
    !expenseCategories.success
  ) {
    return { ok: false, code: "INCOMPLETE_RECORDS" };
  }

  const parsedData: QaiBackupData = {
    customers: customers.data,
    services: services.data,
    bookings: bookings.data,
    payments: payments.data,
    expenses: expenses.data,
    serviceCategories: serviceCategories.data,
    expenseCategories: expenseCategories.data,
  };

  if (
    duplicateIds(parsedData.customers) ||
    duplicateIds(parsedData.services) ||
    duplicateIds(parsedData.bookings) ||
    duplicateIds(parsedData.payments) ||
    duplicateIds(parsedData.expenses) ||
    duplicateIds(parsedData.serviceCategories) ||
    duplicateIds(parsedData.expenseCategories)
  ) {
    return { ok: false, code: "INCOMPLETE_RECORDS" };
  }

  const customerIds = new Set(parsedData.customers.map((item) => item.id));
  const serviceIds = new Set(parsedData.services.map((item) => item.id));
  const bookingIds = new Set(parsedData.bookings.map((item) => item.id));
  const serviceCategoryIds = new Set(parsedData.serviceCategories.map((item) => item.id));
  const expenseCategoryIds = new Set(parsedData.expenseCategories.map((item) => item.id));

  if (parsedData.services.some((service) => !serviceCategoryIds.has(service.categoryId))) {
    return { ok: false, code: "BROKEN_LINKS" };
  }

  if (parsedData.bookings.some((booking) => !customerIds.has(booking.customerId) || !serviceIds.has(booking.serviceId))) {
    return { ok: false, code: "BROKEN_LINKS" };
  }

  if (parsedData.payments.some((payment) => !bookingIds.has(payment.bookingId))) {
    return { ok: false, code: "BROKEN_LINKS" };
  }

  if (
    parsedData.expenses.some(
      (expense) =>
        !expenseCategoryIds.has(expense.categoryId) ||
        (expense.bookingId !== null && !bookingIds.has(expense.bookingId)),
    )
  ) {
    return { ok: false, code: "BROKEN_LINKS" };
  }

  return {
    ok: true,
    backup: {
      app: QAI_BACKUP_APP,
      backupVersion: QAI_BACKUP_VERSION,
      createdAt: new Date().toISOString(),
      data: parsedData,
    },
  };
}

function readAllData(): QaiBackupData {
  return {
    serviceCategories: serviceCategoryRepository.getAll(),
    expenseCategories: expenseCategoryRepository.getAll(),
    customers: customerRepository.getAll(),
    services: serviceRepository.getAll(),
    bookings: bookingRepository.getAll(),
    payments: paymentRepository.getAll(),
    expenses: expenseRepository.getAll(),
  };
}

function writeAllData(data: QaiBackupData): void {
  serviceCategoryRepository.save(data.serviceCategories);
  expenseCategoryRepository.save(data.expenseCategories);
  customerRepository.save(data.customers);
  serviceRepository.save(data.services);
  bookingRepository.save(data.bookings);
  paymentRepository.save(data.payments);
  expenseRepository.save(data.expenses);
}

function sortedById<T extends { id: string }>(records: readonly T[]): T[] {
  return [...records].sort((a, b) => a.id.localeCompare(b.id));
}

function normalizeForCompare(data: QaiBackupData) {
  return {
    customers: sortedById(data.customers),
    services: sortedById(data.services),
    bookings: sortedById(data.bookings),
    payments: sortedById(data.payments),
    expenses: sortedById(data.expenses),
    serviceCategories: sortedById(data.serviceCategories),
    expenseCategories: sortedById(data.expenseCategories),
  };
}

function dataMatches(left: QaiBackupData, right: QaiBackupData) {
  return JSON.stringify(normalizeForCompare(left)) === JSON.stringify(normalizeForCompare(right));
}

export function createBackupFilename(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `qai-backup-${year}-${month}-${day}-${hours}${minutes}.json`;
}

export function createBackupPayload(): QaiBackupFile {
  const data = readAllData();
  return {
    app: QAI_BACKUP_APP,
    backupVersion: QAI_BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    data,
  };
}

export function downloadBackup(payload: QaiBackupFile): void {
  const fileName = createBackupFilename(new Date());
  const serialized = JSON.stringify(payload, null, 2);
  const blob = new Blob([serialized], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function parseBackupFile(file: File): Promise<ValidationResult> {
  if (file.size > MAX_BACKUP_FILE_SIZE_BYTES) {
    return { ok: false, code: "FILE_TOO_LARGE" };
  }

  const text = await file.text();
  if (!text.trim()) {
    return { ok: false, code: "INVALID_FILE" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, code: "INVALID_FILE" };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, code: "INVALID_FILE" };
  }

  const payload = parsed as Record<string, unknown>;
  if (payload.app !== QAI_BACKUP_APP) {
    return { ok: false, code: "INVALID_FILE" };
  }

  if (typeof payload.backupVersion !== "number" || !Number.isInteger(payload.backupVersion)) {
    return { ok: false, code: "INVALID_FILE" };
  }

  if (payload.backupVersion !== QAI_BACKUP_VERSION) {
    return { ok: false, code: "UNSUPPORTED_VERSION" };
  }

  if (typeof payload.createdAt !== "string" || Number.isNaN(new Date(payload.createdAt).getTime())) {
    return { ok: false, code: "INVALID_FILE" };
  }

  const validated = validateDataSets(payload.data);
  if (!validated.ok) return validated;

  return {
    ok: true,
    backup: {
      app: QAI_BACKUP_APP,
      backupVersion: QAI_BACKUP_VERSION,
      createdAt: payload.createdAt,
      data: validated.backup.data,
    },
  };
}

export function restoreBackup(backup: QaiBackupFile): boolean {
  const previousData = readAllData();

  try {
    writeAllData(backup.data);
    const restoredData = readAllData();
    if (!dataMatches(backup.data, restoredData)) {
      throw new Error("RESTORE_VERIFY_FAILED");
    }
    return true;
  } catch {
    try {
      writeAllData(previousData);
      const rolledBack = readAllData();
      if (!dataMatches(previousData, rolledBack)) {
        throw new Error("ROLLBACK_VERIFY_FAILED");
      }
    } catch {
      return false;
    }
    return false;
  }
}

export function toBackupValidationMessage(code: BackupValidationErrorCode): string {
  if (code === "FILE_TOO_LARGE") return "This backup file is too large.";
  if (code === "UNSUPPORTED_VERSION") return "This backup version is not supported.";
  if (code === "INCOMPLETE_RECORDS") return "Some records in this backup are incomplete.";
  if (code === "BROKEN_LINKS") return "This backup contains broken links between records.";
  return "This backup file is not valid.";
}
