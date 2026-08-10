"use client";

import type { Booking } from "@/features/booking/types";
import type { BookingDeleteResult } from "@/features/booking/api/bookingRepository";
import type { Customer } from "@/features/customer/types";
import type { ExpenseCategory } from "@/features/expense-category/types";
import type { Expense } from "@/features/expense/types";
import type { Payment } from "@/features/payment/types";
import type { ServiceCategory } from "@/features/service-category/types";
import type { Service } from "@/features/service/types";
import { createClient } from "./client";

type DbRow = Record<string, unknown>;

export type ActiveBusinessContext = {
  businessId: string;
  currency: string;
  timezone: string;
};

let activeBusinessPromise: Promise<ActiveBusinessContext> | null = null;

function valueAsString(row: DbRow, key: string): string {
  const value = row[key];
  return typeof value === "string" ? value : "";
}

function valueAsNumber(row: DbRow, key: string): number {
  const value = row[key];
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function valueAsBoolean(row: DbRow, key: string): boolean {
  return row[key] === true;
}

function timestamp(value: unknown): number {
  if (typeof value !== "string") return Date.now();
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

function isoTimestamp(value: number): string {
  return new Date(value).toISOString();
}

function rows(data: unknown): DbRow[] {
  return Array.isArray(data) ? data as DbRow[] : [];
}

function throwOnError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export function resetActiveBusinessContext(): void {
  activeBusinessPromise = null;
}

export function getActiveBusinessContext(): Promise<ActiveBusinessContext> {
  if (activeBusinessPromise) return activeBusinessPromise;

  activeBusinessPromise = (async () => {
    const supabase = createClient();
    const { data: membership, error: membershipError } = await supabase
      .from("business_memberships")
      .select("business_id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    throwOnError(membershipError);

    const businessId = typeof membership?.business_id === "string"
      ? membership.business_id
      : null;
    if (!businessId) throw new Error("BUSINESS_REQUIRED");

    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("currency, timezone")
      .eq("id", businessId)
      .single();
    throwOnError(businessError);

    return {
      businessId,
      currency: typeof business?.currency === "string" ? business.currency : "IDR",
      timezone: typeof business?.timezone === "string" ? business.timezone : "Asia/Jakarta",
    };
  })().catch((error) => {
    activeBusinessPromise = null;
    throw error;
  });

  return activeBusinessPromise;
}

async function getAll<T>(
  table: string,
  mapper: (row: DbRow) => T,
  orderColumn = "created_at",
): Promise<T[]> {
  const { businessId } = await getActiveBusinessContext();
  const { data, error } = await createClient()
    .from(table)
    .select("*")
    .eq("business_id", businessId)
    .order(orderColumn, { ascending: true });
  throwOnError(error);
  return rows(data).map(mapper);
}

async function insert(table: string, record: DbRow): Promise<void> {
  const { businessId } = await getActiveBusinessContext();
  const { error } = await createClient().from(table).insert({
    ...record,
    business_id: businessId,
  });
  throwOnError(error);
}

async function update(table: string, id: string, record: DbRow): Promise<void> {
  const { businessId } = await getActiveBusinessContext();
  const { error } = await createClient()
    .from(table)
    .update(record)
    .eq("business_id", businessId)
    .eq("id", id);
  throwOnError(error);
}

async function remove(table: string, id: string): Promise<void> {
  const { businessId } = await getActiveBusinessContext();
  const { error } = await createClient()
    .from(table)
    .delete()
    .eq("business_id", businessId)
    .eq("id", id);
  throwOnError(error);
}

async function upsertAll(table: string, records: DbRow[]): Promise<void> {
  if (records.length === 0) return;
  const { businessId } = await getActiveBusinessContext();
  const { error } = await createClient().from(table).upsert(
    records.map((record) => ({ ...record, business_id: businessId })),
    { onConflict: "id" },
  );
  throwOnError(error);
}

function customerFromRow(row: DbRow): Customer {
  return {
    id: valueAsString(row, "id"),
    name: valueAsString(row, "name"),
    phone: valueAsString(row, "phone"),
    instagram: valueAsString(row, "instagram"),
    email: valueAsString(row, "email"),
    notes: valueAsString(row, "notes"),
    createdAt: timestamp(row.created_at),
  };
}

function customerToRow(customer: Customer): DbRow {
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    instagram: customer.instagram,
    email: customer.email,
    notes: customer.notes,
    created_at: isoTimestamp(customer.createdAt),
  };
}

export const cloudCustomerRepository = {
  getAll: () => getAll("customers", customerFromRow),
  create: (customer: Customer) => insert("customers", customerToRow(customer)),
  update: (customer: Customer) => update("customers", customer.id, customerToRow(customer)),
  delete: (id: string) => remove("customers", id),
};

function categoryFromRow<T extends ServiceCategory | ExpenseCategory>(row: DbRow): T {
  return {
    id: valueAsString(row, "id"),
    name: valueAsString(row, "name"),
    color: valueAsString(row, "color"),
    active: valueAsBoolean(row, "active"),
    createdAt: valueAsString(row, "created_at"),
    updatedAt: valueAsString(row, "updated_at"),
  } as T;
}

function categoryToRow(category: ServiceCategory | ExpenseCategory): DbRow {
  return {
    id: category.id,
    name: category.name.trim(),
    color: category.color,
    active: category.active,
    created_at: category.createdAt,
    updated_at: category.updatedAt,
  };
}

function categoryRepository<T extends ServiceCategory | ExpenseCategory>(table: string) {
  return {
    getAll: () => getAll(table, (row) => categoryFromRow<T>(row)),
    create: (category: T) => insert(table, categoryToRow(category)),
    update: (category: T) => update(table, category.id, categoryToRow(category)),
    delete: (id: string) => remove(table, id),
  };
}

export const cloudServiceCategoryRepository = categoryRepository<ServiceCategory>("service_categories");
export const cloudExpenseCategoryRepository = categoryRepository<ExpenseCategory>("expense_categories");

function serviceFromRow(row: DbRow): Service {
  return {
    id: valueAsString(row, "id"),
    name: valueAsString(row, "name"),
    categoryId: valueAsString(row, "category_id"),
    price: valueAsNumber(row, "price"),
    duration: valueAsNumber(row, "duration_minutes"),
    description: valueAsString(row, "description"),
    active: valueAsBoolean(row, "active"),
  };
}

function serviceToRow(service: Service): DbRow {
  return {
    id: service.id,
    name: service.name,
    category_id: service.categoryId,
    price: service.price,
    duration_minutes: service.duration,
    description: service.description,
    active: service.active,
  };
}

export const cloudServiceRepository = {
  getAll: () => getAll("services", serviceFromRow, "name"),
  create: (service: Service) => insert("services", serviceToRow(service)),
  update: (service: Service) => update("services", service.id, serviceToRow(service)),
  delete: (id: string) => remove("services", id),
  save: (services: Service[]) => upsertAll("services", services.map(serviceToRow)),
};

function bookingFromRow(row: DbRow): Booking {
  return {
    id: valueAsString(row, "id"),
    customerId: valueAsString(row, "customer_id"),
    serviceId: valueAsString(row, "service_id"),
    bookingDate: valueAsString(row, "booking_date"),
    startTime: valueAsString(row, "start_time").slice(0, 5),
    endTime: valueAsString(row, "end_time").slice(0, 5),
    location: valueAsString(row, "location"),
    servicePrice: valueAsNumber(row, "service_price"),
    bookingStatus: valueAsString(row, "booking_status") as Booking["bookingStatus"],
    fullPaymentDueDate: valueAsString(row, "full_payment_due_date"),
    notes: valueAsString(row, "notes"),
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
  };
}

async function bookingToRow(booking: Booking): Promise<DbRow> {
  const { timezone } = await getActiveBusinessContext();
  return {
    id: booking.id,
    customer_id: booking.customerId,
    service_id: booking.serviceId,
    booking_date: booking.bookingDate,
    start_time: booking.startTime,
    end_time: booking.endTime,
    timezone,
    location: booking.location,
    service_price: booking.servicePrice,
    booking_status: booking.bookingStatus,
    full_payment_due_date: booking.fullPaymentDueDate,
    notes: booking.notes,
    created_at: isoTimestamp(booking.createdAt),
    updated_at: isoTimestamp(booking.updatedAt),
  };
}

export const cloudBookingRepository = {
  getAll: () => getAll("bookings", bookingFromRow, "booking_date"),
  async create(booking: Booking) {
    await insert("bookings", await bookingToRow(booking));
  },
  async update(booking: Booking) {
    await update("bookings", booking.id, await bookingToRow(booking));
  },
  async delete(id: string): Promise<BookingDeleteResult> {
    const { businessId } = await getActiveBusinessContext();
    const supabase = createClient();
    const [payments, expenses] = await Promise.all([
      supabase.from("payments").select("id", { count: "exact", head: true })
        .eq("business_id", businessId).eq("booking_id", id),
      supabase.from("expenses").select("id", { count: "exact", head: true })
        .eq("business_id", businessId).eq("booking_id", id),
    ]);
    throwOnError(payments.error);
    throwOnError(expenses.error);
    if ((payments.count ?? 0) > 0 || (expenses.count ?? 0) > 0) return "blocked";
    await remove("bookings", id);
    return "deleted";
  },
};

function paymentFromRow(row: DbRow): Payment {
  return {
    id: valueAsString(row, "id"),
    bookingId: valueAsString(row, "booking_id"),
    date: valueAsString(row, "payment_date"),
    amount: valueAsNumber(row, "amount"),
    method: valueAsString(row, "method") as Payment["method"],
    notes: valueAsString(row, "notes"),
    createdAt: timestamp(row.created_at),
  };
}

function paymentToRow(payment: Payment): DbRow {
  return {
    id: payment.id,
    booking_id: payment.bookingId,
    payment_date: payment.date,
    amount: payment.amount,
    method: payment.method,
    notes: payment.notes,
    created_at: isoTimestamp(payment.createdAt),
  };
}

export const cloudPaymentRepository = {
  getAll: () => getAll("payments", paymentFromRow, "payment_date"),
  create: (payment: Payment) => insert("payments", paymentToRow(payment)),
  update: (payment: Payment) => update("payments", payment.id, paymentToRow(payment)),
  delete: (id: string) => remove("payments", id),
};

function expenseFromRow(row: DbRow): Expense {
  const bookingId = row.booking_id;
  return {
    id: valueAsString(row, "id"),
    date: valueAsString(row, "expense_date"),
    categoryId: valueAsString(row, "category_id"),
    amount: valueAsNumber(row, "amount"),
    paymentMethod: valueAsString(row, "payment_method") as Expense["paymentMethod"],
    expenseType: valueAsString(row, "expense_type") as Expense["expenseType"],
    bookingId: typeof bookingId === "string" ? bookingId : null,
    vendor: valueAsString(row, "vendor"),
    notes: valueAsString(row, "notes"),
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
  };
}

function expenseToRow(expense: Expense): DbRow {
  return {
    id: expense.id,
    expense_date: expense.date,
    category_id: expense.categoryId,
    amount: expense.amount,
    payment_method: expense.paymentMethod,
    expense_type: expense.expenseType,
    booking_id: expense.bookingId,
    vendor: expense.vendor,
    notes: expense.notes,
    created_at: isoTimestamp(expense.createdAt),
    updated_at: isoTimestamp(expense.updatedAt),
  };
}

export const cloudExpenseRepository = {
  getAll: () => getAll("expenses", expenseFromRow, "expense_date"),
  create: (expense: Expense) => insert("expenses", expenseToRow(expense)),
  update: (expense: Expense) => update("expenses", expense.id, expenseToRow(expense)),
  delete: (id: string) => remove("expenses", id),
  save: (expenses: Expense[]) => upsertAll("expenses", expenses.map(expenseToRow)),
};
