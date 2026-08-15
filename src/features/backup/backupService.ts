import { z } from "zod";
import { bookingRepository } from "@/features/booking/api/bookingRepository";
import { bookingRecordSchema } from "@/features/booking/schema";
import { BOOKING_STORAGE_KEY, BOOKING_STORAGE_VERSION } from "@/features/booking/constants";
import { migrateLegacyBookingRecords } from "@/features/booking/api/localStorageRepository";
import { customerRepository } from "@/features/customer/api/customerRepository";
import { customerRecordSchema } from "@/features/customer/schema";
import { CUSTOMER_STORAGE_KEY } from "@/features/customer/constants";
import { expenseCategoryRepository } from "@/features/expense-category/api/expenseCategoryRepository";
import { expenseRepository } from "@/features/expense/api/expenseRepository";
import { expenseRecordSchema } from "@/features/expense/schema";
import { EXPENSE_CATEGORY_STORAGE_KEY, EXPENSE_STORAGE_KEY, EXPENSE_STORAGE_VERSION } from "@/features/expense/constants";
import { paymentRepository } from "@/features/payment/api/paymentRepository";
import { paymentRecordSchema } from "@/features/payment/schema";
import { PAYMENT_STORAGE_KEY, PAYMENT_STORAGE_VERSION } from "@/features/payment/constants";
import { serviceCategoryRepository } from "@/features/service-category/api/serviceCategoryRepository";
import { serviceRepository } from "@/features/service/api/serviceRepository";
import { serviceRecordSchema } from "@/features/service/schema";
import { SERVICE_CATEGORY_STORAGE_KEY, SERVICE_STORAGE_KEY, SERVICE_STORAGE_VERSION } from "@/features/service/constants";
import { categoryRecordSchema } from "@/features/category/schema";
import { BulkPersistenceError, writeVersionedCollectionsAndConfirm } from "@/lib/persistence";
import { ADDITIONAL_CHARGE_CATEGORY_STORAGE_KEY, additionalChargeCategorySchema, getAdditionalChargeCategories } from "@/features/booking/domain/additionalChargeCategories";
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

export type RestoreBackupResult =
  | { ok: true }
  | { ok: false; stage: "local-write" | "remote-confirmation" | "rollback"; storageKey: string };

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
  const additionalChargeCategories = toArraySchema(additionalChargeCategorySchema).safeParse(source.additionalChargeCategories ?? []);

  if (
    !customers.success ||
    !services.success ||
    !bookings.success ||
    !payments.success ||
    !expenses.success ||
    !serviceCategories.success ||
    !expenseCategories.success ||
    !additionalChargeCategories.success
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
    additionalChargeCategories: additionalChargeCategories.data,
  };

  if (
    duplicateIds(parsedData.customers) ||
    duplicateIds(parsedData.services) ||
    duplicateIds(parsedData.bookings) ||
    duplicateIds(parsedData.payments) ||
    duplicateIds(parsedData.expenses) ||
    duplicateIds(parsedData.serviceCategories) ||
    duplicateIds(parsedData.expenseCategories) ||
    duplicateIds(parsedData.additionalChargeCategories ?? [])
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

function migrateBackupData(data: unknown, version: number): unknown {
  if (version !== 1 || !data || typeof data !== "object" || Array.isArray(data)) return data;
  const source = data as Record<string, unknown>;
  const bookings = Array.isArray(source.bookings)
    ? migrateLegacyBookingRecords(source.bookings)
    : source.bookings;
  const services = Array.isArray(source.services)
    ? source.services.map((record) => {
        if (!record || typeof record !== "object" || Array.isArray(record)) return record;
        return { defaultSessionCount: 1, ...record };
      })
    : source.services;
  return { ...source, bookings, services };
}

function readAllData(): QaiBackupData {
  return {
    serviceCategories: serviceCategoryRepository.getAll(),
    expenseCategories: expenseCategoryRepository.getAll(),
    additionalChargeCategories: getAdditionalChargeCategories(),
    customers: customerRepository.getAll(),
    services: serviceRepository.getAll(),
    bookings: bookingRepository.getAll(),
    payments: paymentRepository.getAll(),
    expenses: expenseRepository.getAll(),
  };
}

function backupCollectionWrites(data: QaiBackupData) {
  return [
    { storageKey: SERVICE_CATEGORY_STORAGE_KEY, recordSchema: categoryRecordSchema, records: data.serviceCategories },
    { storageKey: EXPENSE_CATEGORY_STORAGE_KEY, recordSchema: categoryRecordSchema, records: data.expenseCategories },
    { storageKey: ADDITIONAL_CHARGE_CATEGORY_STORAGE_KEY, recordSchema: additionalChargeCategorySchema, records: data.additionalChargeCategories ?? [] },
    { storageKey: CUSTOMER_STORAGE_KEY, recordSchema: customerRecordSchema, records: data.customers },
    { storageKey: SERVICE_STORAGE_KEY, recordSchema: serviceRecordSchema, records: data.services, version: SERVICE_STORAGE_VERSION },
    { storageKey: BOOKING_STORAGE_KEY, recordSchema: bookingRecordSchema, records: data.bookings, version: BOOKING_STORAGE_VERSION },
    { storageKey: PAYMENT_STORAGE_KEY, recordSchema: paymentRecordSchema, records: data.payments, version: PAYMENT_STORAGE_VERSION },
    { storageKey: EXPENSE_STORAGE_KEY, recordSchema: expenseRecordSchema, records: data.expenses, version: EXPENSE_STORAGE_VERSION },
  ];
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
    additionalChargeCategories: sortedById(data.additionalChargeCategories?.length ? data.additionalChargeCategories : getAdditionalChargeCategories()),
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

  if (payload.backupVersion !== 1 && payload.backupVersion !== QAI_BACKUP_VERSION) {
    return { ok: false, code: "UNSUPPORTED_VERSION" };
  }

  if (typeof payload.createdAt !== "string" || Number.isNaN(new Date(payload.createdAt).getTime())) {
    return { ok: false, code: "INVALID_FILE" };
  }

  const validated = validateDataSets(migrateBackupData(payload.data, payload.backupVersion));
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

export async function restoreBackup(backup: QaiBackupFile): Promise<RestoreBackupResult> {
  try {
    await writeVersionedCollectionsAndConfirm(backupCollectionWrites(backup.data));
    const restoredData = readAllData();
    if (!dataMatches(backup.data, restoredData)) {
      throw new Error("RESTORE_VERIFY_FAILED");
    }
    return { ok: true };
  } catch (error) {
    const failure = error instanceof BulkPersistenceError
      ? { stage: error.stage, storageKey: error.storageKey }
      : { stage: "local-write" as const, storageKey: "qai:backup" };
    console.error("[QAI_BULK_PERSISTENCE] backup restore failed", failure);
    return { ok: false, ...failure };
  }
}

export function toBackupValidationMessage(code: BackupValidationErrorCode): string {
  if (code === "FILE_TOO_LARGE") return "This backup file is too large.";
  if (code === "UNSUPPORTED_VERSION") return "This backup version is not supported.";
  if (code === "INCOMPLETE_RECORDS") return "Some records in this backup are incomplete.";
  if (code === "BROKEN_LINKS") return "This backup contains broken links between records.";
  return "This backup file is not valid.";
}
