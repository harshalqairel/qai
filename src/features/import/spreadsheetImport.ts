import { z } from "zod";

import { BOOKING_STORAGE_KEY, BOOKING_STORAGE_VERSION } from "@/features/booking/constants";
import { bookingRepository } from "@/features/booking/api/bookingRepository";
import { bookingRecordSchema } from "@/features/booking/schema";
import type { Booking } from "@/features/booking/types";
import { zonedDateTimeToIso } from "@/features/booking/utils/bookingSessions";
import { categoryRecordSchema } from "@/features/category/schema";
import type { BaseCategory } from "@/features/category/types";
import { customerRepository } from "@/features/customer/api/customerRepository";
import { CUSTOMER_STORAGE_KEY } from "@/features/customer/constants";
import { customerRecordSchema } from "@/features/customer/schema";
import type { Customer } from "@/features/customer/types";
import { expenseCategoryRepository } from "@/features/expense-category/api/expenseCategoryRepository";
import { expenseRepository } from "@/features/expense/api/expenseRepository";
import { EXPENSE_CATEGORY_STORAGE_KEY, EXPENSE_STORAGE_KEY, EXPENSE_STORAGE_VERSION } from "@/features/expense/constants";
import { expenseRecordSchema } from "@/features/expense/schema";
import type { Expense } from "@/features/expense/types";
import { paymentRepository } from "@/features/payment/api/paymentRepository";
import { PAYMENT_STORAGE_KEY, PAYMENT_STORAGE_VERSION, PAYMENT_METHODS } from "@/features/payment/constants";
import { paymentRecordSchema } from "@/features/payment/schema";
import type { Payment, PaymentMethod } from "@/features/payment/types";
import { serviceCategoryRepository } from "@/features/service-category/api/serviceCategoryRepository";
import { serviceRepository } from "@/features/service/api/serviceRepository";
import { SERVICE_CATEGORY_STORAGE_KEY, SERVICE_STORAGE_KEY, SERVICE_STORAGE_VERSION } from "@/features/service/constants";
import { serviceRecordSchema } from "@/features/service/schema";
import type { Service } from "@/features/service/types";
import { emitDataRefresh } from "@/lib/dataRefresh";
import { readVersionedCollection, writeVersionedCollectionsAtomically } from "@/lib/persistence";

export const IMPORT_DOMAINS = ["ignore", "clients", "services", "bookings", "schedules", "payments", "expenses"] as const;
export type ImportDomain = typeof IMPORT_DOMAINS[number];
export type ImportSheet = { name: string; headers: string[]; rows: string[][]; domain: ImportDomain; mapping: Record<string, string> };
export type SpreadsheetPreview = { fileName: string; sourceHash: string; sheets: ImportSheet[] };
export type ImportResult = { status: "completed" | "already_imported"; counts: Record<Exclude<ImportDomain, "ignore">, number> };

type Field = { key: string; label: string; aliases: string[]; required?: boolean };
export const DOMAIN_FIELDS: Record<Exclude<ImportDomain, "ignore">, Field[]> = {
  clients: [field("name", "Client name", ["name", "client", "customer", "nama", "nama pelanggan"], true), field("phone", "Phone", ["phone", "whatsapp", "wa", "telepon", "no hp"]), field("email", "Email", ["email", "e-mail"]), field("instagram", "Instagram", ["instagram", "ig"]), field("notes", "Notes", ["notes", "catatan"])],
  services: [field("name", "Service name", ["service", "service name", "layanan", "jasa", "nama layanan"], true), field("category", "Category", ["category", "kategori"]), field("price", "Price", ["price", "harga", "booking value"], true), field("duration", "Duration minutes", ["duration", "duration minutes", "durasi", "menit"]), field("session_count", "Usual schedules", ["sessions", "session count", "jumlah sesi", "jumlah jadwal"]), field("description", "Description", ["description", "deskripsi"])],
  bookings: [field("booking_id", "Booking reference", ["booking id", "booking ref", "reference", "kode booking", "id booking"]), field("client", "Client", ["client", "customer", "nama pelanggan", "pelanggan"], true), field("phone", "Client phone", ["phone", "whatsapp", "telepon", "no hp"]), field("service", "Service", ["service", "layanan", "jasa"], true), field("price", "Booking price", ["price", "harga", "booking value"], true), field("status", "Status", ["status", "booking status"]), field("due_date", "Payment due", ["due date", "payment due", "jatuh tempo"]), field("date", "First schedule date", ["date", "booking date", "tanggal", "tanggal booking"]), field("start", "Start time", ["start", "start time", "jam mulai", "waktu"]), field("end", "End time", ["end", "end time", "jam selesai"]), field("location", "Location", ["location", "lokasi", "venue"]), field("label", "Schedule label", ["label", "event", "acara"]), field("notes", "Notes", ["notes", "catatan"])],
  schedules: [field("booking_id", "Booking reference", ["booking id", "booking ref", "reference", "kode booking", "id booking"], true), field("date", "Date", ["date", "tanggal"], true), field("start", "Start time", ["start", "start time", "jam mulai"], true), field("end", "End time", ["end", "end time", "jam selesai"]), field("location", "Location", ["location", "lokasi", "venue"]), field("label", "Label", ["label", "event", "acara"]), field("notes", "Notes", ["notes", "catatan"])],
  payments: [field("booking_id", "Booking reference", ["booking id", "booking ref", "reference", "kode booking"], true), field("date", "Payment date", ["date", "payment date", "tanggal", "tanggal bayar"], true), field("amount", "Amount", ["amount", "payment", "paid", "jumlah", "pembayaran"], true), field("method", "Method", ["method", "payment method", "metode"]), field("notes", "Notes", ["notes", "catatan"])],
  expenses: [field("date", "Date", ["date", "expense date", "tanggal"], true), field("category", "Category", ["category", "kategori"], true), field("amount", "Amount", ["amount", "expense", "jumlah", "pengeluaran"], true), field("type", "Type", ["type", "expense type", "jenis"]), field("booking_id", "Booking reference", ["booking id", "booking ref", "kode booking"]), field("vendor", "Vendor", ["vendor", "paid to", "supplier", "penerima"]), field("method", "Method", ["method", "payment method", "metode"]), field("notes", "Notes", ["notes", "description", "catatan", "deskripsi"])],
};

function field(key: string, label: string, aliases: string[], required = false): Field { return { key, label, aliases, required }; }
function normalized(value: string) { return value.normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, " ").trim(); }
function valueAt(sheet: ImportSheet, row: string[], fieldKey: string) { const header = Object.entries(sheet.mapping).find(([, key]) => key === fieldKey)?.[0]; const index = header ? sheet.headers.indexOf(header) : -1; return index >= 0 ? (row[index] ?? "").trim() : ""; }

function suggestedDomain(name: string, headers: string[]): ImportDomain {
  const key = normalized(name); const direct: Array<[ImportDomain, string[]]> = [["clients", ["client", "customer", "pelanggan"]], ["services", ["service", "layanan", "jasa"]], ["schedules", ["schedule", "session", "jadwal", "sesi"]], ["payments", ["payment", "income", "pembayaran", "pendapatan"]], ["expenses", ["expense", "pengeluaran", "biaya"]], ["bookings", ["booking", "job", "pesanan"]]];
  for (const [domain, words] of direct) if (words.some((word) => key.includes(word))) return domain;
  const joined = headers.map(normalized).join(" ");
  if (/booking.*date|client.*service|customer.*service/.test(joined)) return "bookings";
  return "ignore";
}

export function suggestMapping(domain: ImportDomain, headers: string[]): Record<string, string> {
  if (domain === "ignore") return {};
  const used = new Set<string>(); const mapping: Record<string, string> = {};
  for (const header of headers) { const key = normalized(header); const match = DOMAIN_FIELDS[domain].find((item) => !used.has(item.key) && item.aliases.some((alias) => normalized(alias) === key)); if (match) { mapping[header] = match.key; used.add(match.key); } }
  return mapping;
}

function parseCsv(text: string): string[][] {
  const delimiter = (text.split(/\r?\n/, 1)[0].match(/;/g)?.length ?? 0) > (text.split(/\r?\n/, 1)[0].match(/,/g)?.length ?? 0) ? ";" : text.includes("\t") ? "\t" : ",";
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let index = 0; index < text.length; index += 1) { const char = text[index]; if (char === '"') { if (quoted && text[index + 1] === '"') { cell += '"'; index += 1; } else quoted = !quoted; } else if (char === delimiter && !quoted) { row.push(cell); cell = ""; } else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && text[index + 1] === "\n") index += 1; row.push(cell); if (row.some((value) => value.trim())) rows.push(row); row = []; cell = ""; } else cell += char; }
  row.push(cell); if (row.some((value) => value.trim())) rows.push(row); return rows;
}

function displayCell(value: unknown): string { if (value instanceof Date) return value.toISOString().slice(0, 10); if (value && typeof value === "object" && "result" in value) return displayCell((value as { result: unknown }).result); if (value === null || value === undefined) return ""; return String(value); }

export async function parseSpreadsheetFile(file: File): Promise<SpreadsheetPreview> {
  if (file.size > 10 * 1024 * 1024) throw new Error("Use a spreadsheet up to 10 MB.");
  const bytes = await file.arrayBuffer(); const sourceHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const rawSheets: Array<{ name: string; values: string[][] }> = [];
  if (/\.csv$/i.test(file.name) || file.type === "text/csv") rawSheets.push({ name: file.name.replace(/\.csv$/i, ""), values: parseCsv(new TextDecoder().decode(bytes)) });
  else if (/\.xlsx$/i.test(file.name)) { const { Workbook } = await import("exceljs"); const workbook = new Workbook(); await workbook.xlsx.load(bytes); for (const worksheet of workbook.worksheets) { const values: string[][] = []; worksheet.eachRow({ includeEmpty: false }, (excelRow) => { const row: string[] = []; for (let column = 1; column <= worksheet.columnCount; column += 1) row.push(displayCell(excelRow.getCell(column).value)); values.push(row); }); rawSheets.push({ name: worksheet.name, values }); } }
  else throw new Error("Choose an .xlsx or .csv file.");
  const sheets = rawSheets.filter((sheet) => sheet.values.length > 0).map((sheet): ImportSheet => { const headers = sheet.values[0].map((value, index) => value.trim() || `Column ${index + 1}`); const domain = suggestedDomain(sheet.name, headers); return { name: sheet.name, headers, rows: sheet.values.slice(1, 501), domain, mapping: suggestMapping(domain, headers) }; });
  if (!sheets.length) throw new Error("No spreadsheet rows were found."); return { fileName: file.name, sourceHash, sheets };
}

function numberValue(value: string): number { const cleaned = value.replace(/[^\d,.-]/g, ""); if (!cleaned) return 0; const normalizedNumber = cleaned.includes(",") && cleaned.includes(".") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned.replace(/,(?=\d{3}(?:\D|$))/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", "."); return Number(normalizedNumber) || 0; }
function dateValue(value: string): string { const trimmed = value.trim(); if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed; const match = trimmed.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/); if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`; const date = new Date(trimmed); return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10); }
function timeValue(value: string, fallback: string) { const match = value.trim().match(/^(\d{1,2})[:.]?(\d{2})?/); if (!match) return fallback; return `${match[1].padStart(2, "0")}:${(match[2] ?? "00").padStart(2, "0")}`; }
function nextDate(date: string): string { const value = new Date(`${date}T00:00:00.000Z`); value.setUTCDate(value.getUTCDate() + 1); return value.toISOString().slice(0, 10); }
function scheduleTimes(date: string, start: string, end: string, timezone: string) { return { startAt: zonedDateTimeToIso(date, start, timezone), endAt: zonedDateTimeToIso(end <= start ? nextDate(date) : date, end, timezone) }; }
function paymentMethod(value: string): PaymentMethod { const key = normalized(value); if (key.includes("cash") || key.includes("tunai")) return "Cash"; if (key.includes("qris")) return "QRIS"; if (key.includes("wallet")) return "E-Wallet"; if (key.includes("credit")) return "Credit Card"; if (key.includes("bank") || key.includes("transfer")) return "Bank Transfer"; return PAYMENT_METHODS.includes(value as PaymentMethod) ? value as PaymentMethod : "Other"; }
function category(name: string, color: string): BaseCategory { const now = new Date().toISOString(); return { id: crypto.randomUUID(), name: name.trim() || "Other", color, active: true, createdAt: now, updatedAt: now }; }
function importedKey(sourceHash: string, domain: string, row: number) { return `${sourceHash}:${domain}:${row}`; }
const receiptSchema = z.object({ id: z.string(), sourceHash: z.string(), fileName: z.string(), createdAt: z.number() });
const RECEIPTS_KEY = "qai:spreadsheet-import-receipts";

export function validateSpreadsheetPreview(preview: SpreadsheetPreview): string[] {
  const errors: string[] = [];
  for (const sheet of preview.sheets) { if (sheet.domain === "ignore") continue; for (const field of DOMAIN_FIELDS[sheet.domain].filter((item) => item.required)) if (!Object.values(sheet.mapping).includes(field.key)) errors.push(`${sheet.name}: map ${field.label}.`); }
  if (!preview.sheets.some((sheet) => sheet.domain !== "ignore")) errors.push("Choose what at least one sheet contains."); return errors;
}

export function commitSpreadsheetImport(preview: SpreadsheetPreview, timezone: string): ImportResult {
  const receipts = readVersionedCollection(RECEIPTS_KEY, receiptSchema); if (receipts.some((item) => item.sourceHash === preview.sourceHash)) return { status: "already_imported", counts: { clients: 0, services: 0, bookings: 0, schedules: 0, payments: 0, expenses: 0 } };
  const errors = validateSpreadsheetPreview(preview); if (errors.length) throw new Error(errors[0]);
  const customers = [...customerRepository.getAll()] as Array<Customer & { importKey?: string }>;
  const services = [...serviceRepository.getAll()] as Array<Service & { importKey?: string }>;
  return commitCollections(preview, timezone, receipts, customers, services);
}

function commitCollections(preview: SpreadsheetPreview, timezone: string, receipts: z.infer<typeof receiptSchema>[], customers: Array<Customer & { importKey?: string }>, services: Array<Service & { importKey?: string }>): ImportResult {
  // Kept synchronous so local collections and the remote mirror advance together.
  const bookings = [...bookingRepository.getAll()] as Array<Booking & { importKey?: string }>;
  const payments = [...paymentRepository.getAll()] as Array<Payment & { importKey?: string }>;
  const expenses = [...expenseRepository.getAll()] as Array<Expense & { importKey?: string }>;
  const serviceCategories = [...serviceCategoryRepository.getAll()]; const expenseCategories = [...expenseCategoryRepository.getAll()];
  const counts = { clients: 0, services: 0, bookings: 0, schedules: 0, payments: 0, expenses: 0 }; const now = Date.now(); const bookingRefs = new Map<string, Booking>();
  const findCustomer = (name: string, phone = "") => { const key = normalized(name); const digits = phone.replace(/\D/g, ""); let found = customers.find((item) => (digits && item.phone.replace(/\D/g, "") === digits) || normalized(item.name) === key); if (!found && name.trim()) { found = { id: crypto.randomUUID(), name: name.trim(), phone: phone.trim() || "-", email: "", instagram: "", notes: "Imported from spreadsheet", createdAt: now }; customers.push(found); counts.clients += 1; } return found; };
  const findService = (name: string, price = 0) => services.find((item) => normalized(item.name) === normalized(name)) ?? (name.trim() && price > 0 ? (() => { let cat = serviceCategories.find((item) => normalized(item.name) === "imported"); if (!cat) { cat = category("Imported", "#5B8C85"); serviceCategories.push(cat); } const created: Service = { id: crypto.randomUUID(), name: name.trim(), categoryId: cat.id, price, duration: 60, defaultSessionCount: 1, description: "Imported from spreadsheet", active: true }; services.push(created); counts.services += 1; return created; })() : undefined);
  for (const booking of bookings) { const reference = (booking as Booking & { importReference?: string }).importReference; if (reference) bookingRefs.set(reference, booking); }
  const findBookingByReference = (reference: string) => bookingRefs.get(reference) ?? bookingRefs.get(normalized(reference));

  for (const sheet of preview.sheets.filter((item) => item.domain === "clients")) sheet.rows.forEach((row, index) => { const name = valueAt(sheet, row, "name"); if (!name || customers.some((item) => item.importKey === importedKey(preview.sourceHash, "clients", index))) return; const existing = findCustomer(name, valueAt(sheet, row, "phone")); if (existing) { existing.email ||= valueAt(sheet, row, "email"); existing.instagram ||= valueAt(sheet, row, "instagram"); existing.notes ||= valueAt(sheet, row, "notes"); (existing as Customer & { importKey?: string }).importKey ||= importedKey(preview.sourceHash, "clients", index); } });
  for (const sheet of preview.sheets.filter((item) => item.domain === "services")) sheet.rows.forEach((row, index) => { const name = valueAt(sheet, row, "name"); const price = numberValue(valueAt(sheet, row, "price")); if (!name || price <= 0 || services.some((item) => normalized(item.name) === normalized(name))) return; const categoryName = valueAt(sheet, row, "category") || "Imported"; let cat = serviceCategories.find((item) => normalized(item.name) === normalized(categoryName)); if (!cat) { cat = category(categoryName, "#5B8C85"); serviceCategories.push(cat); } services.push({ id: crypto.randomUUID(), name, categoryId: cat.id, price, duration: Math.max(1, numberValue(valueAt(sheet, row, "duration")) || 60), defaultSessionCount: Math.min(50, Math.max(1, numberValue(valueAt(sheet, row, "session_count")) || 1)), description: valueAt(sheet, row, "description"), active: true, importKey: importedKey(preview.sourceHash, "services", index) } as Service & { importKey: string }); counts.services += 1; });
  for (const sheet of preview.sheets.filter((item) => item.domain === "bookings")) sheet.rows.forEach((row, index) => {
    const importKey = importedKey(preview.sourceHash, "bookings", index);
    const explicitReference = valueAt(sheet, row, "booking_id");
    const existing = bookings.find((item) => item.importKey === importKey || (explicitReference && (item as Booking & { importReference?: string }).importReference === normalized(explicitReference)));
    if (existing) { bookingRefs.set(explicitReference || String(index + 1), existing); return; }
    const client = findCustomer(valueAt(sheet, row, "client"), valueAt(sheet, row, "phone"));
    const service = findService(valueAt(sheet, row, "service"), numberValue(valueAt(sheet, row, "price")));
    const date = dateValue(valueAt(sheet, row, "date"));
    if (!client || !service) return;
    const id = crypto.randomUUID(); const start = timeValue(valueAt(sheet, row, "start"), "09:00"); const end = timeValue(valueAt(sheet, row, "end"), "10:00");
    const sessions = date ? [{ id: crypto.randomUUID(), bookingId: id, sequence: 1, label: valueAt(sheet, row, "label"), ...scheduleTimes(date, start, end, timezone), location: valueAt(sheet, row, "location"), notes: "", createdAt: now, updatedAt: now }] : [];
    const statusValue = normalized(valueAt(sheet, row, "status"));
    const booking: Booking & { importKey: string; importReference?: string } = { id, customerId: client.id, serviceId: service.id, sessions, servicePrice: numberValue(valueAt(sheet, row, "price")) || service.price, bookingStatus: statusValue.includes("cancel") || statusValue.includes("batal") ? "Cancelled" : statusValue.includes("complete") || statusValue.includes("selesai") ? "Completed" : "Scheduled", fullPaymentDueDate: dateValue(valueAt(sheet, row, "due_date")) || date, notes: valueAt(sheet, row, "notes"), createdAt: now, updatedAt: now, importKey, ...(explicitReference ? { importReference: normalized(explicitReference) } : {}) };
    bookings.push(booking); bookingRefs.set(explicitReference || String(index + 1), booking); counts.bookings += 1; if (sessions.length) counts.schedules += 1;
  });
  for (const sheet of preview.sheets.filter((item) => item.domain === "schedules")) sheet.rows.forEach((row) => {
    const reference = valueAt(sheet, row, "booking_id"); const booking = findBookingByReference(reference); const date = dateValue(valueAt(sheet, row, "date"));
    if (!booking || !date) return;
    const start = timeValue(valueAt(sheet, row, "start"), "09:00"); const end = timeValue(valueAt(sheet, row, "end"), "10:00"); const times = scheduleTimes(date, start, end, timezone);
    if (booking.sessions.some((session) => session.startAt === times.startAt && session.endAt === times.endAt)) return;
    booking.sessions.push({ id: crypto.randomUUID(), bookingId: booking.id, sequence: booking.sessions.length + 1, label: valueAt(sheet, row, "label"), ...times, location: valueAt(sheet, row, "location"), notes: valueAt(sheet, row, "notes"), createdAt: now, updatedAt: now }); counts.schedules += 1; booking.fullPaymentDueDate ||= date;
  });
  for (let index = bookings.length - 1; index >= 0; index -= 1) if (bookings[index].sessions.length === 0) { const removed = bookings.splice(index, 1)[0]; if (removed.importKey?.startsWith(preview.sourceHash)) counts.bookings -= 1; }
  for (const sheet of preview.sheets.filter((item) => item.domain === "payments")) sheet.rows.forEach((row, index) => { const key = importedKey(preview.sourceHash, "payments", index); const booking = findBookingByReference(valueAt(sheet, row, "booking_id")); const amount = numberValue(valueAt(sheet, row, "amount")); const date = dateValue(valueAt(sheet, row, "date")); const method = paymentMethod(valueAt(sheet, row, "method")); if (!booking || !date || amount <= 0 || payments.some((item) => item.importKey === key || (item.bookingId === booking.id && item.date === date && item.amount === amount && item.method === method))) return; payments.push({ id: crypto.randomUUID(), bookingId: booking.id, date, amount, method, notes: valueAt(sheet, row, "notes"), createdAt: now, importKey: key } as Payment & { importKey: string }); counts.payments += 1; });
  for (const sheet of preview.sheets.filter((item) => item.domain === "expenses")) sheet.rows.forEach((row, index) => { const key = importedKey(preview.sourceHash, "expenses", index); const amount = numberValue(valueAt(sheet, row, "amount")); const date = dateValue(valueAt(sheet, row, "date")); const vendor = valueAt(sheet, row, "vendor"); const notes = valueAt(sheet, row, "notes"); if (!date || amount <= 0 || expenses.some((item) => item.importKey === key || (item.date === date && item.amount === amount && normalized(item.vendor) === normalized(vendor) && normalized(item.notes) === normalized(notes)))) return; const categoryName = valueAt(sheet, row, "category") || "Other"; let cat = expenseCategories.find((item) => normalized(item.name) === normalized(categoryName)); if (!cat) { cat = category(categoryName, "#718096"); expenseCategories.push(cat); } const booking = findBookingByReference(valueAt(sheet, row, "booking_id")); const bookingExpense = Boolean(booking) || /booking|job|proyek/.test(normalized(valueAt(sheet, row, "type"))); expenses.push({ id: crypto.randomUUID(), date, categoryId: cat.id, amount, paymentMethod: paymentMethod(valueAt(sheet, row, "method")), expenseType: bookingExpense && booking ? "Booking Expense" : "Business Expense", bookingId: bookingExpense && booking ? booking.id : null, vendor, notes, createdAt: now, updatedAt: now, importKey: key } as Expense & { importKey: string }); counts.expenses += 1; });
  const nextReceipts = [...receipts, { id: crypto.randomUUID(), sourceHash: preview.sourceHash, fileName: preview.fileName, createdAt: now }];
  writeVersionedCollectionsAtomically([
    { storageKey: CUSTOMER_STORAGE_KEY, recordSchema: customerRecordSchema, records: customers }, { storageKey: SERVICE_CATEGORY_STORAGE_KEY, recordSchema: categoryRecordSchema, records: serviceCategories },
    { storageKey: SERVICE_STORAGE_KEY, recordSchema: serviceRecordSchema, records: services, version: SERVICE_STORAGE_VERSION }, { storageKey: BOOKING_STORAGE_KEY, recordSchema: bookingRecordSchema, records: bookings, version: BOOKING_STORAGE_VERSION },
    { storageKey: PAYMENT_STORAGE_KEY, recordSchema: paymentRecordSchema, records: payments, version: PAYMENT_STORAGE_VERSION }, { storageKey: EXPENSE_CATEGORY_STORAGE_KEY, recordSchema: categoryRecordSchema, records: expenseCategories },
    { storageKey: EXPENSE_STORAGE_KEY, recordSchema: expenseRecordSchema, records: expenses, version: EXPENSE_STORAGE_VERSION }, { storageKey: RECEIPTS_KEY, recordSchema: receiptSchema, records: nextReceipts },
  ]); emitDataRefresh(); return { status: "completed", counts };
}
