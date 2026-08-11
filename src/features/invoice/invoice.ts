import { z } from "zod";

import type { Booking, BookingSession } from "@/features/booking/types";
import type { Customer } from "@/features/customer/types";
import type { Payment } from "@/features/payment/types";
import { formatRupiah, sumPaymentsForBooking } from "@/features/payment/utils/paymentCalculations";
import type { Service } from "@/features/service/types";
import { emitDataRefresh } from "@/lib/dataRefresh";
import { readVersionedCollection, writeVersionedCollection } from "@/lib/persistence";

export const INVOICE_STORAGE_KEY = "qai:invoices";
export const INVOICE_SETTINGS_STORAGE_KEY = "qai:invoice-settings";
export const INVOICE_TEMPLATE_STORAGE_KEY = "qai:invoice-share-templates";
export const LOCAL_INVOICE_BUSINESS_ID = "local-business";

export type InvoiceLifecycle = "Draft" | "Revision Draft" | "Issued";
export type InvoiceStyle = "Creative" | "Neutral" | "Professional";
export type InvoiceDiscountMode = "none" | "fixed" | "percentage";
export type InvoicePaymentStatus = "Unpaid" | "Part paid" | "Paid";

export type InvoiceLineItem = {
  id: string;
  item: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

export type InvoiceSchedule = {
  label: string;
  startAt: string;
  endAt: string;
  location: string;
};

export type InvoiceSnapshot = {
  invoiceNumber: string;
  businessName: string;
  legalName: string;
  businessLogo: string;
  address: string;
  phone: string;
  email: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  serviceName: string;
  invoiceDate: string;
  dueDate: string;
  lineItems: InvoiceLineItem[];
  discount: number;
  tax: number;
  discountMode: InvoiceDiscountMode;
  discountValue: number;
  taxPercent: number;
  subtotal: number;
  total: number;
  paymentInstructions: string;
  notes: string;
  schedules: InvoiceSchedule[];
  showSchedules: boolean;
  invoiceStyle: InvoiceStyle;
  signatureImage: string;
  stampImage: string;
  legalDisclaimer: string;
  version: number;
};

export type Invoice = {
  id: string;
  businessId: string;
  bookingId: string | null;
  clientId: string | null;
  lifecycle: InvoiceLifecycle;
  rootInvoiceId: string;
  previousVersionId: string | null;
  version: number;
  invoiceNumber: string | null;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  serviceName: string;
  invoiceDate: string;
  dueDate: string;
  lineItems: InvoiceLineItem[];
  discount: number;
  tax: number;
  discountMode: InvoiceDiscountMode;
  discountValue: number;
  taxPercent: number;
  invoiceStyle: InvoiceStyle;
  paymentInstructions: string;
  notes: string;
  schedules: InvoiceSchedule[];
  showSchedules: boolean;
  snapshot: InvoiceSnapshot | null;
  createdAt: number;
  updatedAt: number;
  issuedAt: number | null;
};

export type InvoiceSettings = {
  businessId: string;
  businessLogo: string;
  businessName: string;
  legalName: string;
  address: string;
  phone: string;
  email: string;
  invoicePrefix: string;
  nextInvoiceSequence: number;
  invoiceNumberPadding: number;
  invoiceStyle: InvoiceStyle;
  signatureImage: string;
  stampImage: string;
  legalDisclaimer: string;
  paymentInstructions: string;
  defaultNotes: string;
  defaultPaymentTerms: string;
  showSchedules: boolean;
  showQaiAttribution: boolean;
};

export type InvoiceShareTemplates = {
  whatsapp: string;
  emailSubject: string;
  emailBody: string;
};

export type InvoiceShareContext = {
  clientName: string;
  businessName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  invoiceTotal: string;
  amountPaid: string;
  amountRemaining: string;
  serviceName: string;
  bookingDate: string;
  nextSchedule: string;
  paymentInstructions: string;
};

const lineItemSchema = z.object({
  id: z.string().min(1), item: z.string().trim().min(1).max(160), description: z.string().max(500),
  quantity: z.number().finite().positive().max(10000), unitPrice: z.number().finite().nonnegative().max(1_000_000_000_000),
});
const scheduleSchema = z.object({ label: z.string().max(120), startAt: z.string().datetime(), endAt: z.string().datetime(), location: z.string().max(500) });
const snapshotSchema = z.object({
  invoiceNumber: z.string().min(1), businessName: z.string().max(160), legalName: z.string().max(160), businessLogo: z.string().max(3_000_000),
  address: z.string().max(1000), phone: z.string().max(80), email: z.string().max(160), clientName: z.string().max(160),
  clientPhone: z.string().max(80), clientEmail: z.string().max(160), serviceName: z.string().max(160), invoiceDate: z.string(), dueDate: z.string(),
  lineItems: z.array(lineItemSchema).min(1).max(200), discount: z.number().nonnegative(), tax: z.number().nonnegative(), discountMode: z.enum(["none", "fixed", "percentage"]).default("none"), discountValue: z.number().nonnegative().default(0), taxPercent: z.number().min(0).max(100).default(0), subtotal: z.number().nonnegative(),
  total: z.number().nonnegative(), paymentInstructions: z.string().max(4000), notes: z.string().max(5000), schedules: z.array(scheduleSchema).max(100), showSchedules: z.boolean(), invoiceStyle: z.enum(["Creative", "Neutral", "Professional"]).default("Neutral"), signatureImage: z.string().max(3_000_000).default(""), stampImage: z.string().max(3_000_000).default(""), legalDisclaimer: z.string().max(1000).default(""), version: z.number().int().positive().default(1),
});
export const invoiceSchema = z.object({
  id: z.string().min(1), businessId: z.string().min(1), bookingId: z.string().nullable(), clientId: z.string().nullable(),
  lifecycle: z.enum(["Draft", "Revision Draft", "Issued"]), rootInvoiceId: z.string().min(1).optional(), previousVersionId: z.string().nullable().default(null), version: z.number().int().positive().default(1), invoiceNumber: z.string().nullable(), clientName: z.string().trim().min(1).max(160),
  clientPhone: z.string().max(80), clientEmail: z.string().max(160), serviceName: z.string().max(160), invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), lineItems: z.array(lineItemSchema).min(1).max(200), discount: z.number().finite().nonnegative(),
  tax: z.number().finite().nonnegative(), discountMode: z.enum(["none", "fixed", "percentage"]).default("none"), discountValue: z.number().finite().nonnegative().default(0), taxPercent: z.number().finite().min(0).max(100).default(0), invoiceStyle: z.enum(["Creative", "Neutral", "Professional"]).default("Neutral"), paymentInstructions: z.string().max(4000), notes: z.string().max(5000), schedules: z.array(scheduleSchema).max(100),
  showSchedules: z.boolean(), snapshot: snapshotSchema.nullable(), createdAt: z.number().int().nonnegative(), updatedAt: z.number().int().nonnegative(), issuedAt: z.number().int().nonnegative().nullable(),
}).transform((value) => ({ ...value, rootInvoiceId: value.rootInvoiceId ?? value.id }));
const settingsSchema = z.object({
  businessId: z.string().min(1), businessLogo: z.string().max(3_000_000), businessName: z.string().trim().min(1).max(160), legalName: z.string().max(160),
  address: z.string().max(1000), phone: z.string().max(80), email: z.string().max(160), invoicePrefix: z.string().trim().min(1).max(12).regex(/^[A-Za-z0-9-]+$/), nextInvoiceSequence: z.number().int().positive().default(1), invoiceNumberPadding: z.number().int().min(2).max(8).default(4), invoiceStyle: z.enum(["Creative", "Neutral", "Professional"]).default("Neutral"), signatureImage: z.string().max(3_000_000).default(""), stampImage: z.string().max(3_000_000).default(""), legalDisclaimer: z.string().max(1000).default(""),
  paymentInstructions: z.string().max(4000), defaultNotes: z.string().max(5000), defaultPaymentTerms: z.string().max(2000), showSchedules: z.boolean(), showQaiAttribution: z.boolean(),
});
const templatesSchema = z.object({ businessId: z.string().min(1), whatsapp: z.string().max(4000), emailSubject: z.string().max(200), emailBody: z.string().max(4000) });

export const DEFAULT_INVOICE_SETTINGS: InvoiceSettings = {
  businessId: LOCAL_INVOICE_BUSINESS_ID,
  businessLogo: "",
  businessName: "My business",
  legalName: "",
  address: "",
  phone: "",
  email: "",
  invoicePrefix: "INV",
  nextInvoiceSequence: 1,
  invoiceNumberPadding: 4,
  invoiceStyle: "Neutral",
  signatureImage: "",
  stampImage: "",
  legalDisclaimer: "Uploaded signature and stamp images are visual business marks, not certified electronic signatures.",
  paymentInstructions: "",
  defaultNotes: "",
  defaultPaymentTerms: "",
  showSchedules: true,
  showQaiAttribution: true,
};

export const DEFAULT_INVOICE_SHARE_TEMPLATES: InvoiceShareTemplates = {
  whatsapp: "Hi {client_name},\n\nHere is invoice {invoice_number} from {business_name}.\n\nTotal: {invoice_total}\nPaid: {amount_paid}\nRemaining: {amount_remaining}\nDue date: {due_date}\n\nThank you.",
  emailSubject: "Invoice {invoice_number} - {business_name}",
  emailBody: "Hi {client_name},\n\nHere is invoice {invoice_number} from {business_name}.\n\nTotal: {invoice_total}\nPaid: {amount_paid}\nRemaining: {amount_remaining}\nDue date: {due_date}\n\nThank you.",
};

export const INVOICE_SHARE_VARIABLES = [
  { token: "{client_name}", label: "Client name", key: "clientName" },
  { token: "{business_name}", label: "Business name", key: "businessName" },
  { token: "{invoice_number}", label: "Invoice number", key: "invoiceNumber" },
  { token: "{invoice_date}", label: "Invoice date", key: "invoiceDate" },
  { token: "{due_date}", label: "Due date", key: "dueDate" },
  { token: "{invoice_total}", label: "Invoice total", key: "invoiceTotal" },
  { token: "{amount_paid}", label: "Amount paid", key: "amountPaid" },
  { token: "{amount_remaining}", label: "Amount remaining", key: "amountRemaining" },
  { token: "{service_name}", label: "Service", key: "serviceName" },
  { token: "{booking_date}", label: "Booking date", key: "bookingDate" },
  { token: "{next_schedule}", label: "Next schedule", key: "nextSchedule" },
  { token: "{payment_instructions}", label: "Payment instructions", key: "paymentInstructions" },
] as const;

const TOKEN_PATTERN = /\{[^{}\n]+\}/g;
const KNOWN_TOKENS = new Set(INVOICE_SHARE_VARIABLES.map((item) => item.token));

export function validateInvoiceShareTemplate(value: string, limit = 4000): string[] {
  const errors: string[] = [];
  for (const token of [...new Set(value.match(TOKEN_PATTERN) ?? [])]) {
    if (!KNOWN_TOKENS.has(token as never)) errors.push(`Unknown variable: ${token.slice(1, -1).replaceAll("_", " ")}`);
  }
  if (/\{[^}\n]*$|^[^{\n]*\}/m.test(value)) errors.push("Check that every variable has an opening and closing brace.");
  if (!value.trim()) errors.push("This template cannot be empty.");
  if (value.length > limit) errors.push(`Keep this template under ${limit.toLocaleString()} characters.`);
  return errors;
}

export function renderInvoiceShareTemplate(value: string, context: InvoiceShareContext): { value: string; errors: string[] } {
  const errors = validateInvoiceShareTemplate(value);
  if (errors.length) return { value: "", errors };
  const values = Object.fromEntries(INVOICE_SHARE_VARIABLES.map((item) => [item.token, String(context[item.key] ?? "").trim()]));
  return {
    value: value.replace(TOKEN_PATTERN, (token) => values[token] ?? "").split("\n").filter((line) => !/^\s*[^:]+:\s*$/.test(line)).join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    errors: [],
  };
}

export function insertInvoiceTemplateVariable(value: string, token: string, start: number, end = start): string {
  const safeStart = Math.max(0, Math.min(start, value.length));
  const safeEnd = Math.max(safeStart, Math.min(end, value.length));
  return `${value.slice(0, safeStart)}${token}${value.slice(safeEnd)}`;
}

export function invoiceTotals(invoice: Pick<Invoice, "lineItems" | "discount" | "tax"> & Partial<Pick<Invoice, "discountMode" | "discountValue" | "taxPercent">>) {
  const subtotal = invoice.lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const legacyDiscount = Math.max(invoice.discount ?? 0, 0);
  const discountMode = invoice.discountMode ?? (legacyDiscount > 0 ? "fixed" : "none");
  const discountValue = invoice.discountValue ?? legacyDiscount;
  const discount = discountMode === "percentage" ? Math.min(subtotal, subtotal * Math.min(discountValue, 100) / 100) : discountMode === "fixed" ? Math.min(subtotal, discountValue) : 0;
  const taxable = Math.max(subtotal - discount, 0);
  const tax = invoice.taxPercent !== undefined ? taxable * Math.min(Math.max(invoice.taxPercent, 0), 100) / 100 : Math.max(invoice.tax ?? 0, 0);
  const total = Math.max(taxable + tax, 0);
  return { subtotal, discount, tax, total };
}

export function invoicePaymentStatus(total: number, paid: number): InvoicePaymentStatus {
  if (paid <= 0) return "Unpaid";
  if (paid < total) return "Part paid";
  return "Paid";
}

export function invoicePaidAmount(invoice: Invoice, payments: Payment[]): number {
  return invoice.bookingId ? sumPaymentsForBooking(invoice.bookingId, payments) : 0;
}

export function invoiceRemainingAmount(invoice: Invoice, payments: Payment[]): number {
  return Math.max(invoiceTotals(invoice.snapshot ?? invoice).total - invoicePaidAmount(invoice, payments), 0);
}

export function formatInvoiceDate(value: string): string {
  if (!value) return "Not set";
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function scheduleFromBooking(value: BookingSession): InvoiceSchedule {
  return { label: value.label, startAt: value.startAt, endAt: value.endAt, location: value.location };
}

export function createBookingInvoiceDraft(args: { booking: Booking; customer: Customer; service: Service; settings: InvoiceSettings; now?: number }): Invoice {
  const now = args.now ?? Date.now();
  const id = crypto.randomUUID();
  const invoiceDate = new Date(now).toISOString().slice(0, 10);
  return invoiceSchema.parse({
    id, businessId: args.settings.businessId, bookingId: args.booking.id, clientId: args.customer.id,
    lifecycle: "Draft", rootInvoiceId: id, previousVersionId: null, version: 1, invoiceNumber: null, clientName: args.customer.name, clientPhone: args.customer.phone, clientEmail: args.customer.email,
    serviceName: args.service.name, invoiceDate, dueDate: args.booking.fullPaymentDueDate || invoiceDate,
    lineItems: [{ id: crypto.randomUUID(), item: args.service.name, description: args.service.description, quantity: 1, unitPrice: args.booking.servicePrice }],
    discount: 0, tax: 0, discountMode: "none", discountValue: 0, taxPercent: 0, invoiceStyle: args.settings.invoiceStyle, paymentInstructions: args.settings.paymentInstructions, notes: args.settings.defaultNotes || args.settings.defaultPaymentTerms,
    schedules: args.booking.sessions.map(scheduleFromBooking), showSchedules: args.settings.showSchedules, snapshot: null, createdAt: now, updatedAt: now, issuedAt: null,
  });
}

export function issueInvoice(invoice: Invoice, settings: InvoiceSettings, allInvoices: Invoice[], now = Date.now(), allocatedNumber?: string): Invoice {
  if (invoice.lifecycle === "Issued") return invoice;
  const parsed = invoiceSchema.parse(invoice);
  const year = new Date(now).getFullYear();
  const prefix = settings.invoicePrefix.toUpperCase();
  const expression = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-${year}-(\\d+)$`);
  const next = Math.max(settings.nextInvoiceSequence - 1, allInvoices.reduce((maximum, item) => {
    const match = item.invoiceNumber?.match(expression);
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0)) + 1;
  const baseNumber = allocatedNumber ?? `${prefix}-${year}-${String(next).padStart(settings.invoiceNumberPadding, "0")}`;
  const original = parsed.version > 1 ? allInvoices.find((item) => item.id === parsed.rootInvoiceId) : null;
  const invoiceNumber = parsed.version > 1 ? `${original?.invoiceNumber ?? baseNumber.replace(/-R\d+$/, "")}-R${parsed.version}` : baseNumber;
  const totals = invoiceTotals(parsed);
  const snapshot: InvoiceSnapshot = snapshotSchema.parse({
    invoiceNumber, businessName: settings.businessName, legalName: settings.legalName, businessLogo: settings.businessLogo,
    address: settings.address, phone: settings.phone, email: settings.email, clientName: parsed.clientName, clientPhone: parsed.clientPhone,
    clientEmail: parsed.clientEmail, serviceName: parsed.serviceName, invoiceDate: parsed.invoiceDate, dueDate: parsed.dueDate,
    lineItems: structuredClone(parsed.lineItems), ...totals, discountMode: parsed.discountMode, discountValue: parsed.discountValue, taxPercent: parsed.taxPercent,
    paymentInstructions: parsed.paymentInstructions, notes: parsed.notes, schedules: structuredClone(parsed.schedules), showSchedules: parsed.showSchedules,
    invoiceStyle: parsed.invoiceStyle, signatureImage: settings.signatureImage, stampImage: settings.stampImage, legalDisclaimer: settings.legalDisclaimer, version: parsed.version,
  });
  return { ...parsed, lifecycle: "Issued", invoiceNumber, snapshot, issuedAt: now, updatedAt: now };
}

export function createInvoiceRevision(invoice: Invoice, now = Date.now(), version = invoice.version + 1): Invoice {
  if (invoice.lifecycle !== "Issued" || !invoice.snapshot) throw new Error("Only an issued invoice can be revised.");
  const source = invoice.snapshot;
  const id = crypto.randomUUID();
  return invoiceSchema.parse({
    ...invoice, id, rootInvoiceId: invoice.rootInvoiceId || invoice.id, previousVersionId: invoice.id, version,
    lifecycle: "Revision Draft", invoiceNumber: null, clientName: source.clientName, clientPhone: source.clientPhone, clientEmail: source.clientEmail,
    serviceName: source.serviceName, invoiceDate: source.invoiceDate, dueDate: source.dueDate, lineItems: structuredClone(source.lineItems),
    discount: source.discount, tax: source.tax, discountMode: source.discountMode, discountValue: source.discountValue, taxPercent: source.taxPercent,
    invoiceStyle: source.invoiceStyle, paymentInstructions: source.paymentInstructions, notes: source.notes, schedules: structuredClone(source.schedules),
    showSchedules: source.showSchedules, snapshot: null, createdAt: now, updatedAt: now, issuedAt: null,
  });
}

export function latestInvoiceVersions(invoices: Invoice[]): Invoice[] {
  const latest = new Map<string, Invoice>();
  for (const invoice of invoices) { const key = invoice.rootInvoiceId || invoice.id; const current = latest.get(key); if (!current || invoice.version > current.version || (invoice.version === current.version && invoice.updatedAt > current.updatedAt)) latest.set(key, invoice); }
  return [...latest.values()];
}

export function latestReportableInvoiceVersions(invoices: Invoice[]): Invoice[] {
  const roots = new Map<string, Invoice[]>();
  for (const invoice of invoices) {
    const key = invoice.rootInvoiceId || invoice.id;
    roots.set(key, [...(roots.get(key) ?? []), invoice]);
  }
  return [...roots.values()].map((versions) => {
    const issued = versions.filter((invoice) => invoice.lifecycle === "Issued");
    return latestInvoiceVersions(issued.length ? issued : versions)[0];
  });
}

export const invoiceRepository = {
  getAll(): Invoice[] { return readVersionedCollection(INVOICE_STORAGE_KEY, invoiceSchema); },
  save(invoice: Invoice): Invoice {
    const parsed = invoiceSchema.parse(invoice);
    const current = this.getAll();
    const next = current.some((item) => item.id === parsed.id) ? current.map((item) => item.id === parsed.id ? parsed : item) : [...current, parsed];
    writeVersionedCollection(INVOICE_STORAGE_KEY, invoiceSchema, next); emitDataRefresh(); return parsed;
  },
  delete(id: string): void { writeVersionedCollection(INVOICE_STORAGE_KEY, invoiceSchema, this.getAll().filter((item) => item.id !== id)); emitDataRefresh(); },
};

export function getInvoiceSettings(businessId = LOCAL_INVOICE_BUSINESS_ID): InvoiceSettings {
  const stored = readVersionedCollection(INVOICE_SETTINGS_STORAGE_KEY, settingsSchema).find((item) => item.businessId === businessId);
  if (stored) return stored;
  let businessName = DEFAULT_INVOICE_SETTINGS.businessName;
  try { if (typeof window !== "undefined") { const metadata = JSON.parse(window.localStorage.getItem("qai:validation-workspace") ?? "null") as { label?: string } | null; if (metadata?.label) businessName = metadata.label; } } catch { /* Keep the neutral fallback. */ }
  return { ...DEFAULT_INVOICE_SETTINGS, businessId, businessName };
}
export function saveInvoiceSettings(settings: InvoiceSettings): void {
  const parsed = settingsSchema.parse({ ...settings, invoicePrefix: settings.invoicePrefix.toUpperCase() });
  const current = readVersionedCollection(INVOICE_SETTINGS_STORAGE_KEY, settingsSchema);
  writeVersionedCollection(INVOICE_SETTINGS_STORAGE_KEY, settingsSchema, current.some((item) => item.businessId === parsed.businessId) ? current.map((item) => item.businessId === parsed.businessId ? parsed : item) : [...current, parsed]);
  emitDataRefresh();
}
export function getInvoiceShareTemplates(businessId = LOCAL_INVOICE_BUSINESS_ID): InvoiceShareTemplates {
  const record = readVersionedCollection(INVOICE_TEMPLATE_STORAGE_KEY, templatesSchema).find((item) => item.businessId === businessId);
  return record ? { whatsapp: record.whatsapp, emailSubject: record.emailSubject, emailBody: record.emailBody } : structuredClone(DEFAULT_INVOICE_SHARE_TEMPLATES);
}
export function saveInvoiceShareTemplates(templates: InvoiceShareTemplates, businessId = LOCAL_INVOICE_BUSINESS_ID): void {
  const parsed = templatesSchema.parse({ businessId, ...templates });
  const current = readVersionedCollection(INVOICE_TEMPLATE_STORAGE_KEY, templatesSchema);
  writeVersionedCollection(INVOICE_TEMPLATE_STORAGE_KEY, templatesSchema, current.some((item) => item.businessId === businessId) ? current.map((item) => item.businessId === businessId ? parsed : item) : [...current, parsed]);
  emitDataRefresh();
}

export function invoiceShareContext(invoice: Invoice, settings: InvoiceSettings, payments: Payment[]): InvoiceShareContext {
  const source = invoice.snapshot ?? { ...invoice, ...invoiceTotals(invoice), invoiceNumber: invoice.invoiceNumber ?? "Draft", businessName: settings.businessName };
  const total = invoiceTotals(source).total;
  const paid = invoicePaidAmount(invoice, payments);
  const first = source.schedules[0];
  const next = source.schedules.find((item) => Date.parse(item.startAt) >= Date.now()) ?? first;
  return {
    clientName: source.clientName, businessName: "businessName" in source ? source.businessName : settings.businessName,
    invoiceNumber: invoice.invoiceNumber ?? "Draft", invoiceDate: formatInvoiceDate(source.invoiceDate), dueDate: formatInvoiceDate(source.dueDate),
    invoiceTotal: formatRupiah(total), amountPaid: formatRupiah(paid), amountRemaining: formatRupiah(Math.max(total - paid, 0)), serviceName: source.serviceName,
    bookingDate: first ? formatInvoiceDate(first.startAt.slice(0, 10)) : "", nextSchedule: next ? formatInvoiceDate(next.startAt.slice(0, 10)) : "", paymentInstructions: source.paymentInstructions,
  };
}

export function normalizeIndonesianPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("62")) return digits;
  return digits;
}
export function invoiceWhatsAppUrl(phone: string, message: string): string { return `https://wa.me/${normalizeIndonesianPhone(phone)}?text=${encodeURIComponent(message)}`; }
export function invoiceEmailUrl(email: string, subject: string, body: string): string { return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`; }

function safeFilePart(value: string): string { return value.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "Client"; }

async function pdfImageSource(value: string): Promise<string> {
  if (!value || value.startsWith("data:")) return value;
  try { const response = await fetch(value); if (!response.ok) return ""; const blob = await response.blob(); return await new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result ?? "")); reader.onerror = () => resolve(""); reader.readAsDataURL(blob); }); } catch { return ""; }
}

export async function generateInvoicePdf(invoice: Invoice, settings: InvoiceSettings, payments: Payment[], output: "save" | "blob" = "save"): Promise<Blob | null> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const source = invoice.snapshot ?? {
    ...invoice, ...invoiceTotals(invoice), invoiceNumber: invoice.invoiceNumber ?? "DRAFT", businessName: settings.businessName, legalName: settings.legalName,
    businessLogo: settings.businessLogo, address: settings.address, phone: settings.phone, email: settings.email, signatureImage: settings.signatureImage,
    stampImage: settings.stampImage, legalDisclaimer: settings.legalDisclaimer,
  };
  const total = invoiceTotals(source).total;
  const totals = invoiceTotals(source);
  const paid = invoicePaidAmount(invoice, payments);
  const remaining = Math.max(total - paid, 0);
  const [logoImage, signatureImage, stampImage] = await Promise.all([pdfImageSource(source.businessLogo), pdfImageSource(source.signatureImage), pdfImageSource(source.stampImage)]);
  const accent: [number, number, number] = source.invoiceStyle === "Creative" ? [154, 83, 120] : source.invoiceStyle === "Professional" ? [31, 56, 86] : [53, 111, 107];
  const pageWidth = 210; const pageHeight = 297; const margin = 18; const contentWidth = pageWidth - margin * 2;
  let y = 18;
  const ensure = (height: number) => { if (y + height <= pageHeight - 19) return; doc.addPage(); y = 18; };
  const text = (value: string, x: number, size = 9, style: "normal" | "bold" = "normal", width?: number) => {
    doc.setFont("helvetica", style); doc.setFontSize(size); doc.setTextColor(style === "bold" ? 23 : 80, style === "bold" ? 39 : 91, style === "bold" ? 42 : 96);
    const lines = width ? doc.splitTextToSize(value || "", width) : [value || ""];
    ensure(lines.length * (size * 0.42) + 2); doc.text(lines, x, y); y += lines.length * (size * 0.42) + 2;
  };
  if (source.invoiceStyle === "Creative") { doc.setFillColor(249, 241, 246); doc.rect(0, 0, pageWidth, 42, "F"); }
  if (logoImage) {
    try { doc.addImage(logoImage, "AUTO", margin, y, 24, 24, undefined, "FAST"); } catch { /* Keep the PDF usable when a browser cannot decode a saved image. */ }
  }
  const headerX = source.businessLogo ? margin + 30 : margin;
  doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(23, 39, 42); doc.text(source.businessName, headerX, y + 6);
  if (source.legalName) { doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(102, 114, 111); doc.text(source.legalName, headerX, y + 12); }
  doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(...accent); doc.text("INVOICE", pageWidth - margin, y + 6, { align: "right" });
  doc.setFontSize(9); doc.setTextColor(80, 91, 96); doc.text(source.invoiceNumber, pageWidth - margin, y + 13, { align: "right" });
  y += 31; doc.setDrawColor(221, 227, 221); doc.line(margin, y, pageWidth - margin, y); y += 9;
  const leftY = y; text("BILL TO", margin, 8, "bold"); text(source.clientName, margin, 12, "bold", 82); if (source.clientPhone) text(source.clientPhone, margin, 8); if (source.clientEmail) text(source.clientEmail, margin, 8);
  const afterClient = y; y = leftY; const metaX = 126; text("INVOICE DATE", metaX, 8, "bold"); text(formatInvoiceDate(source.invoiceDate), metaX, 9); text("DUE DATE", metaX, 8, "bold"); text(formatInvoiceDate(source.dueDate), metaX, 9); y = Math.max(afterClient, y) + 7;
  doc.setFillColor(238, 241, 236); doc.roundedRect(margin, y, contentWidth, 9, 1.5, 1.5, "F"); doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(80, 91, 96);
  doc.text("ITEM", margin + 3, y + 6); doc.text("QTY", 133, y + 6, { align: "right" }); doc.text("UNIT PRICE", 163, y + 6, { align: "right" }); doc.text("AMOUNT", pageWidth - margin - 3, y + 6, { align: "right" }); y += 13;
  for (const item of source.lineItems) {
    const itemLines: string[] = doc.splitTextToSize(item.item, 80); const descLines: string[] = item.description ? doc.splitTextToSize(item.description, 80) : [];
    const height = Math.max(10, itemLines.length * 4 + descLines.length * 3.5 + 3); ensure(height);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(23, 39, 42); doc.text(itemLines, margin + 3, y);
    if (descLines.length) { doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(102, 114, 111); doc.text(descLines, margin + 3, y + itemLines.length * 4); }
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(23, 39, 42); doc.text(String(item.quantity), 133, y, { align: "right" }); doc.text(formatRupiah(item.unitPrice), 163, y, { align: "right" }); doc.text(formatRupiah(item.quantity * item.unitPrice), pageWidth - margin - 3, y, { align: "right" });
    y += height; doc.setDrawColor(235, 238, 235); doc.line(margin, y - 2, pageWidth - margin, y - 2);
  }
  y += 4; const totalsX = 132; const valueX = pageWidth - margin;
  const totalRow = (label: string, value: number, strong = false) => { ensure(8); doc.setFont("helvetica", strong ? "bold" : "normal"); doc.setFontSize(strong ? 11 : 9); doc.setTextColor(23, 39, 42); doc.text(label, totalsX, y); doc.text(formatRupiah(value), valueX, y, { align: "right" }); y += strong ? 8 : 6; };
  totalRow("Subtotal", totals.subtotal); if (totals.discount > 0) totalRow(source.discountMode === "percentage" ? `Discount (${source.discountValue}%)` : "Discount", -totals.discount); if (totals.tax > 0) totalRow(source.taxPercent ? `Tax (${source.taxPercent}%)` : "Tax", totals.tax); totalRow("Total", total, true); totalRow("Paid", paid); totalRow("Remaining", remaining, true); if (paid > total) totalRow("Overpaid", paid - total); y += 4;
  if (source.showSchedules && source.schedules.length) { text("SCHEDULE", margin, 9, "bold"); for (const schedule of source.schedules) { const start = new Date(schedule.startAt); const end = new Date(schedule.endAt); const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(start); const times = `${start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jakarta" })}-${end.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jakarta" })}`; text(`${date} | ${times}${schedule.label ? ` | ${schedule.label}` : ""}${schedule.location ? ` | ${schedule.location}` : ""}`, margin, 8, "normal", contentWidth); } y += 3; }
  if (source.paymentInstructions) { text("PAYMENT INSTRUCTIONS", margin, 9, "bold"); text(source.paymentInstructions, margin, 9, "normal", contentWidth); y += 3; }
  if (source.notes) { text("NOTES", margin, 9, "bold"); text(source.notes, margin, 9, "normal", contentWidth); }
  if (signatureImage || stampImage) { ensure(34); y += 3; if (signatureImage) { text("AUTHORIZED SIGNATURE", margin, 8, "bold"); try { doc.addImage(signatureImage, "AUTO", margin, y, 42, 20, undefined, "FAST"); } catch { /* visual mark is optional */ } } if (stampImage) { try { doc.addImage(stampImage, "AUTO", margin + 54, y - 5, 24, 24, undefined, "FAST"); } catch { /* visual mark is optional */ } } y += 25; }
  if (source.legalDisclaimer) text(source.legalDisclaimer, margin, 7, "normal", contentWidth);
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) { doc.setPage(page); doc.setDrawColor(221, 227, 221); doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15); doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(130, 140, 138); if (settings.showQaiAttribution) doc.text("Created with Qai", margin, pageHeight - 9); doc.text(`${page} / ${pageCount}`, pageWidth - margin, pageHeight - 9, { align: "right" }); }
  const filename = `${invoice.invoiceNumber ?? "Draft-invoice"}-${safeFilePart(source.clientName)}.pdf`;
  if (output === "save") { doc.save(filename); return null; }
  return doc.output("blob");
}
