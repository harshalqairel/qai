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
export type InvoiceStyle = "Creative" | "Neutral" | "Professional" | "Modern Classic";
export type InvoiceDiscountMode = "none" | "fixed" | "percentage";
export type InvoiceTaxMode = "percentage" | "fixed";
export type InvoiceTaxTreatment = "added" | "deducted";
export type InvoicePaymentStatus = "Unpaid" | "Part paid" | "Paid";

export type InvoiceLayoutProfile = {
  header: "editorial-split" | "quiet-split" | "commercial-grid" | "centered-masthead";
  metadata: "header-dates" | "bill-to-split" | "boxed-ledger" | "ruled-columns";
  lineItems: "editorial" | "minimal" | "commercial-grid" | "numbered-ledger";
  totals: "accent-panel" | "quiet-rule" | "commercial-box" | "classic-ledger";
};

export function invoiceLayoutProfile(style: InvoiceStyle): InvoiceLayoutProfile {
  switch (style) {
    case "Creative":
      return { header: "editorial-split", metadata: "header-dates", lineItems: "editorial", totals: "accent-panel" };
    case "Professional":
      return { header: "commercial-grid", metadata: "boxed-ledger", lineItems: "commercial-grid", totals: "commercial-box" };
    case "Modern Classic":
      return { header: "centered-masthead", metadata: "ruled-columns", lineItems: "numbered-ledger", totals: "classic-ledger" };
    case "Neutral":
    default:
      return { header: "quiet-split", metadata: "bill-to-split", lineItems: "minimal", totals: "quiet-rule" };
  }
}

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
  taxEnabled?: boolean;
  taxName?: string;
  taxMode?: InvoiceTaxMode;
  taxValue?: number;
  taxTreatment?: InvoiceTaxTreatment;
  subtotal: number;
  total: number;
  paymentInstructions: string;
  notes: string;
  schedules: InvoiceSchedule[];
  showSchedules: boolean;
  invoiceStyle: InvoiceStyle;
  signatureImage: string;
  stampImage: string;
  watermarkEnabled?: boolean;
  watermarkImage?: string;
  watermarkOpacity?: number;
  watermarkRotation?: number;
  watermarkScale?: number;
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
  taxEnabled?: boolean;
  taxName?: string;
  taxMode?: InvoiceTaxMode;
  taxValue?: number;
  taxTreatment?: InvoiceTaxTreatment;
  invoiceStyle: InvoiceStyle;
  paymentInstructions: string;
  notes: string;
  schedules: InvoiceSchedule[];
  showSchedules: boolean;
  watermarkEnabled?: boolean;
  watermarkImage?: string;
  watermarkOpacity?: number;
  watermarkRotation?: number;
  watermarkScale?: number;
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
  watermarkEnabled: boolean;
  watermarkImage: string;
  watermarkOpacity: number;
  watermarkRotation: number;
  watermarkScale: number;
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
  lineItems: z.array(lineItemSchema).min(1).max(200), discount: z.number().nonnegative(), tax: z.number().nonnegative(), discountMode: z.enum(["none", "fixed", "percentage"]).default("none"), discountValue: z.number().nonnegative().default(0), taxPercent: z.number().min(0).max(100).default(0), taxEnabled: z.boolean().optional(), taxName: z.string().trim().max(40).optional(), taxMode: z.enum(["percentage", "fixed"]).optional(), taxValue: z.number().nonnegative().optional(), taxTreatment: z.enum(["added", "deducted"]).optional(), subtotal: z.number().nonnegative(),
  total: z.number().nonnegative(), paymentInstructions: z.string().max(4000), notes: z.string().max(5000), schedules: z.array(scheduleSchema).max(100), showSchedules: z.boolean(), invoiceStyle: z.enum(["Creative", "Neutral", "Professional", "Modern Classic"]).default("Neutral"), signatureImage: z.string().max(3_000_000).default(""), stampImage: z.string().max(3_000_000).default(""), watermarkEnabled: z.boolean().default(false), watermarkImage: z.string().max(3_000_000).default(""), watermarkOpacity: z.number().min(0.06).max(0.2).default(0.08), watermarkRotation: z.number().min(-45).max(-20).default(-35), watermarkScale: z.number().min(0.6).max(0.9).default(0.72), legalDisclaimer: z.string().max(1000).default(""), version: z.number().int().positive().default(1),
});
export const invoiceSchema = z.object({
  id: z.string().min(1), businessId: z.string().min(1), bookingId: z.string().nullable(), clientId: z.string().nullable(),
  lifecycle: z.enum(["Draft", "Revision Draft", "Issued"]), rootInvoiceId: z.string().min(1).optional(), previousVersionId: z.string().nullable().default(null), version: z.number().int().positive().default(1), invoiceNumber: z.string().nullable(), clientName: z.string().trim().min(1).max(160),
  clientPhone: z.string().max(80), clientEmail: z.string().max(160), serviceName: z.string().max(160), invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), lineItems: z.array(lineItemSchema).min(1).max(200), discount: z.number().finite().nonnegative(),
  tax: z.number().finite().nonnegative(), discountMode: z.enum(["none", "fixed", "percentage"]).default("none"), discountValue: z.number().finite().nonnegative().default(0), taxPercent: z.number().finite().min(0).max(100).default(0), taxEnabled: z.boolean().optional(), taxName: z.string().trim().max(40).optional(), taxMode: z.enum(["percentage", "fixed"]).optional(), taxValue: z.number().finite().nonnegative().optional(), taxTreatment: z.enum(["added", "deducted"]).optional(), invoiceStyle: z.enum(["Creative", "Neutral", "Professional", "Modern Classic"]).default("Neutral"), paymentInstructions: z.string().max(4000), notes: z.string().max(5000), schedules: z.array(scheduleSchema).max(100),
  showSchedules: z.boolean(), watermarkEnabled: z.boolean().default(false), watermarkImage: z.string().max(3_000_000).default(""), watermarkOpacity: z.number().min(0.06).max(0.2).default(0.08), watermarkRotation: z.number().min(-45).max(-20).default(-35), watermarkScale: z.number().min(0.6).max(0.9).default(0.72), snapshot: snapshotSchema.nullable(), createdAt: z.number().int().nonnegative(), updatedAt: z.number().int().nonnegative(), issuedAt: z.number().int().nonnegative().nullable(),
}).transform((value) => ({ ...value, rootInvoiceId: value.rootInvoiceId ?? value.id }));
const settingsSchema = z.object({
  businessId: z.string().min(1), businessLogo: z.string().max(3_000_000), businessName: z.string().trim().min(1).max(160), legalName: z.string().max(160),
  address: z.string().max(1000), phone: z.string().max(80), email: z.string().max(160), invoicePrefix: z.string().trim().min(1).max(12).regex(/^[A-Za-z0-9-]+$/), nextInvoiceSequence: z.number().int().positive().default(1), invoiceNumberPadding: z.number().int().min(2).max(8).default(4), invoiceStyle: z.enum(["Creative", "Neutral", "Professional", "Modern Classic"]).default("Neutral"), signatureImage: z.string().max(3_000_000).default(""), stampImage: z.string().max(3_000_000).default(""), watermarkEnabled: z.boolean().default(false), watermarkImage: z.string().max(3_000_000).default(""), watermarkOpacity: z.number().min(0.06).max(0.2).default(0.08), watermarkRotation: z.number().min(-45).max(-20).default(-35), watermarkScale: z.number().min(0.6).max(0.9).default(0.72), legalDisclaimer: z.string().max(1000).default(""),
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
  watermarkEnabled: false,
  watermarkImage: "",
  watermarkOpacity: 0.08,
  watermarkRotation: -35,
  watermarkScale: 0.72,
  legalDisclaimer: "",
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

type InvoiceTotalsInput = Pick<Invoice, "lineItems" | "discount" | "tax"> & Partial<Pick<Invoice, "discountMode" | "discountValue" | "taxPercent" | "taxEnabled" | "taxName" | "taxMode" | "taxValue" | "taxTreatment">>;

export function invoiceTaxLabel(invoice: InvoiceTotalsInput): string {
  const name = invoice.taxName?.trim() || "Tax";
  const mode = invoice.taxMode ?? "percentage";
  const value = invoice.taxValue ?? invoice.taxPercent ?? 0;
  return mode === "percentage" && value > 0 ? `${name} (${value}%)` : name;
}

export function invoiceTotals(invoice: InvoiceTotalsInput) {
  const subtotal = invoice.lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const legacyDiscount = Math.max(invoice.discount ?? 0, 0);
  const discountMode = invoice.discountMode ?? (legacyDiscount > 0 ? "fixed" : "none");
  const discountValue = invoice.discountValue ?? legacyDiscount;
  const discount = discountMode === "percentage" ? Math.min(subtotal, subtotal * Math.min(discountValue, 100) / 100) : discountMode === "fixed" ? Math.min(subtotal, discountValue) : 0;
  const taxable = Math.max(subtotal - discount, 0);
  const legacyTaxEnabled = invoice.taxPercent !== undefined ? invoice.taxPercent > 0 : (invoice.tax ?? 0) > 0;
  const taxEnabled = invoice.taxEnabled ?? legacyTaxEnabled;
  const taxMode = invoice.taxMode ?? ((invoice.taxPercent ?? 0) > 0 ? "percentage" : "fixed");
  const taxValue = invoice.taxValue ?? (taxMode === "percentage" ? invoice.taxPercent ?? 0 : invoice.tax ?? 0);
  const tax = taxEnabled ? taxMode === "percentage" ? taxable * Math.min(Math.max(taxValue, 0), 100) / 100 : Math.max(taxValue, 0) : 0;
  const total = Math.max(taxable + (invoice.taxTreatment === "deducted" ? -tax : tax), 0);
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
  const serviceName = [args.booking.serviceSnapshot?.serviceName || args.service.name, args.booking.serviceSnapshot?.variantLabel].filter(Boolean).join(" · ");
  return invoiceSchema.parse({
    id, businessId: args.settings.businessId, bookingId: args.booking.id, clientId: args.customer.id,
    lifecycle: "Draft", rootInvoiceId: id, previousVersionId: null, version: 1, invoiceNumber: null, clientName: args.customer.name, clientPhone: args.customer.phone, clientEmail: args.customer.email,
    serviceName, invoiceDate, dueDate: args.booking.fullPaymentDueDate || invoiceDate,
    lineItems: [
      { id: crypto.randomUUID(), item: serviceName, description: args.service.description, quantity: 1, unitPrice: args.booking.servicePrice },
      ...(args.booking.additionalCharges ?? []).map((charge) => ({ id: crypto.randomUUID(), item: charge.categoryName, description: charge.description, quantity: 1, unitPrice: charge.amount })),
    ],
    discount: 0, tax: 0, discountMode: "none", discountValue: 0, taxPercent: 0, taxEnabled: false, taxName: "Tax", taxMode: "percentage", taxValue: 0, taxTreatment: "added", invoiceStyle: args.settings.invoiceStyle, paymentInstructions: args.settings.paymentInstructions, notes: args.settings.defaultNotes || args.settings.defaultPaymentTerms,
    schedules: args.booking.sessions.map(scheduleFromBooking), showSchedules: args.settings.showSchedules, watermarkEnabled: args.settings.watermarkEnabled, watermarkImage: args.settings.watermarkImage, watermarkOpacity: args.settings.watermarkOpacity, watermarkRotation: args.settings.watermarkRotation, watermarkScale: args.settings.watermarkScale, snapshot: null, createdAt: now, updatedAt: now, issuedAt: null,
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
    lineItems: structuredClone(parsed.lineItems), ...totals, discountMode: parsed.discountMode, discountValue: parsed.discountValue, taxPercent: parsed.taxPercent, taxEnabled: parsed.taxEnabled, taxName: parsed.taxName, taxMode: parsed.taxMode, taxValue: parsed.taxValue, taxTreatment: parsed.taxTreatment,
    paymentInstructions: parsed.paymentInstructions, notes: parsed.notes, schedules: structuredClone(parsed.schedules), showSchedules: parsed.showSchedules,
    invoiceStyle: parsed.invoiceStyle, signatureImage: settings.signatureImage, stampImage: settings.stampImage, watermarkEnabled: parsed.watermarkEnabled, watermarkImage: parsed.watermarkImage, watermarkOpacity: parsed.watermarkOpacity, watermarkRotation: parsed.watermarkRotation, watermarkScale: parsed.watermarkScale, legalDisclaimer: settings.legalDisclaimer, version: parsed.version,
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
    discount: source.discount, tax: source.tax, discountMode: source.discountMode, discountValue: source.discountValue, taxPercent: source.taxPercent, taxEnabled: source.taxEnabled, taxName: source.taxName, taxMode: source.taxMode, taxValue: source.taxValue, taxTreatment: source.taxTreatment,
    invoiceStyle: source.invoiceStyle, paymentInstructions: source.paymentInstructions, notes: source.notes, schedules: structuredClone(source.schedules),
    showSchedules: source.showSchedules, watermarkEnabled: source.watermarkEnabled, watermarkImage: source.watermarkImage, watermarkOpacity: source.watermarkOpacity, watermarkRotation: source.watermarkRotation, watermarkScale: source.watermarkScale, snapshot: null, createdAt: now, updatedAt: now, issuedAt: null,
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

export type InvoiceWatermarkLayout = {
  enabled: boolean;
  image: string;
  opacity: number;
  rotation: number;
  scale: number;
};

export function invoiceWatermarkLayout(source: Pick<Invoice, "watermarkEnabled" | "watermarkImage" | "watermarkOpacity" | "watermarkRotation" | "watermarkScale"> | Pick<InvoiceSnapshot, "watermarkEnabled" | "watermarkImage" | "watermarkOpacity" | "watermarkRotation" | "watermarkScale">): InvoiceWatermarkLayout {
  return {
    enabled: Boolean(source.watermarkEnabled && source.watermarkImage),
    image: source.watermarkImage ?? "",
    opacity: Math.min(0.2, Math.max(0.06, source.watermarkOpacity || 0.08)),
    rotation: Math.min(-20, Math.max(-45, source.watermarkRotation || -35)),
    scale: Math.min(0.9, Math.max(0.6, source.watermarkScale || 0.72)),
  };
}

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
    stampImage: settings.stampImage, watermarkEnabled: invoice.watermarkEnabled, watermarkImage: invoice.watermarkImage, watermarkOpacity: invoice.watermarkOpacity, watermarkRotation: invoice.watermarkRotation, watermarkScale: invoice.watermarkScale, legalDisclaimer: settings.legalDisclaimer,
  };
  const total = invoiceTotals(source).total;
  const totals = invoiceTotals(source);
  const paid = invoicePaidAmount(invoice, payments);
  const remaining = Math.max(total - paid, 0);
  const watermark = invoiceWatermarkLayout(source);
  const [logoImage, signatureImage, stampImage, watermarkImage] = await Promise.all([pdfImageSource(source.businessLogo), pdfImageSource(source.signatureImage), pdfImageSource(source.stampImage), pdfImageSource(watermark.image)]);
  const brandHex = typeof window === "undefined" ? "" : getComputedStyle(document.documentElement).getPropertyValue("--brand").trim();
  const accent: [number, number, number] = /^#[0-9a-f]{6}$/i.test(brandHex)
    ? [Number.parseInt(brandHex.slice(1, 3), 16), Number.parseInt(brandHex.slice(3, 5), 16), Number.parseInt(brandHex.slice(5, 7), 16)]
    : [122, 63, 100];
  type Rgb = [number, number, number];
  const ink: Rgb = [22, 26, 32];
  const body: Rgb = [44, 49, 56];
  const muted: Rgb = [92, 101, 110];
  const rule: Rgb = [207, 213, 218];
  const soft: Rgb = [247, 248, 248];
  const accentSoft: Rgb = accent.map((value) => Math.round(246 + (value - 246) * 0.1)) as Rgb;
  const danger: Rgb = [174, 48, 65];
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const contentBottom = 275;
  const modernClassic = source.invoiceStyle === "Modern Classic";
  const professional = source.invoiceStyle === "Professional";
  const creative = source.invoiceStyle === "Creative";
  const layout = invoiceLayoutProfile(source.invoiceStyle);
  let y = 18;
  const setTextColor = (color: Rgb) => doc.setTextColor(color[0], color[1], color[2]);
  const setDrawColor = (color: Rgb) => doc.setDrawColor(color[0], color[1], color[2]);
  const setFillColor = (color: Rgb) => doc.setFillColor(color[0], color[1], color[2]);
  const drawRule = (lineY: number, weight = 0.18, color: Rgb = rule, startX = margin, endX = pageWidth - margin) => {
    setDrawColor(color);
    doc.setLineWidth(weight);
    doc.line(startX, lineY, endX, lineY);
  };
  const drawContainedImage = (image: string, x: number, top: number, maxWidth: number, maxHeight: number) => {
    try {
      const properties = doc.getImageProperties(image);
      const ratio = properties.width / properties.height;
      let width = maxWidth;
      let height = width / ratio;
      if (height > maxHeight) { height = maxHeight; width = height * ratio; }
      doc.addImage(image, "AUTO", x, top + (maxHeight - height) / 2, width, height, undefined, "FAST");
    } catch { /* Image assets are optional and must never make an invoice unusable. */ }
  };
  const drawWatermark = () => {
    if (!watermark.enabled || !watermarkImage) return;
    try {
      const properties = doc.getImageProperties(watermarkImage);
      const ratio = properties.width / properties.height;
      const maxWidth = pageWidth * watermark.scale;
      const maxHeight = pageHeight * watermark.scale;
      let width = maxWidth;
      let height = width / ratio;
      if (height > maxHeight) { height = maxHeight; width = height * ratio; }
      const radians = watermark.rotation * Math.PI / 180;
      const x = pageWidth / 2 - Math.cos(radians) * width / 2 + Math.sin(radians) * height / 2;
      const top = pageHeight / 2 - height + Math.sin(radians) * width / 2 + Math.cos(radians) * height / 2;
      doc.saveGraphicsState();
      doc.setGState(doc.GState({ opacity: watermark.opacity }));
      doc.addImage(watermarkImage, "AUTO", x, top, width, height, "invoice-watermark", "FAST", watermark.rotation);
      doc.restoreGraphicsState();
    } catch { /* Watermarks are optional and must never make an invoice unusable. */ }
  };
  const drawPageFrame = (firstPage: boolean) => {
    if (creative) {
      if (firstPage) { setFillColor(accentSoft); doc.rect(0, 0, pageWidth, 48, "F"); }
      setFillColor(accent); doc.rect(0, 0, pageWidth, 2.2, "F");
    } else if (professional) {
      setFillColor(accent); doc.rect(0, 0, 3, pageHeight, "F");
    } else if (modernClassic) {
      drawRule(12, 0.65, ink);
    } else {
      drawRule(12, 0.22, rule);
    }
  };
  const drawContinuationHeader = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setTextColor(ink);
    doc.text(source.businessName, margin, 22);
    doc.text(`${source.invoiceNumber} - continued`, pageWidth - margin, 22, { align: "right" });
    drawRule(28, 0.22, modernClassic ? ink : rule);
    y = 35;
  };
  const addFlowPage = () => {
    doc.addPage();
    drawPageFrame(false);
    drawWatermark();
    drawContinuationHeader();
  };
  const ensure = (height: number) => { if (y + height > contentBottom) addFlowPage(); };

  drawPageFrame(true);
  drawWatermark();
  const businessContact = [source.address, source.phone, source.email].filter(Boolean).join(" | ");
  if (layout.header === "editorial-split") {
    doc.setFont("helvetica", "bold"); doc.setFontSize(7); setTextColor(body);
    doc.text("CLIENT DOCUMENT", margin, y + 1);
    doc.setFontSize(25); setTextColor(ink); doc.text("Invoice", margin, y + 11);
    doc.setFontSize(9); doc.text(source.invoiceNumber, margin, y + 18);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); setTextColor(body);
    doc.text(`Invoice date  ${formatInvoiceDate(source.invoiceDate)}`, margin, y + 27);
    doc.text(`Due date      ${formatInvoiceDate(source.dueDate)}`, margin, y + 33);
    if (logoImage) drawContainedImage(logoImage, 105, y - 2, 22, 22);
    const businessX = logoImage ? 132 : 105;
    doc.setFont("helvetica", "bold"); doc.setFontSize(15); setTextColor(ink);
    doc.text(doc.splitTextToSize(source.businessName, pageWidth - margin - businessX), businessX, y + 5);
    let detailY = y + 15;
    if (source.legalName) { doc.setFontSize(8); doc.text(source.legalName, businessX, detailY); detailY += 5; }
    if (businessContact) { doc.setFont("helvetica", "normal"); doc.setFontSize(7); setTextColor(body); doc.text(doc.splitTextToSize(businessContact, pageWidth - margin - businessX), businessX, detailY); }
    y += 41;
  } else if (layout.header === "commercial-grid") {
    doc.setFont("helvetica", "bold"); doc.setFontSize(22); setTextColor(ink); doc.text("INVOICE", margin, y + 5);
    doc.setFontSize(9); doc.text(source.invoiceNumber, margin, y + 13);
    setDrawColor(ink); doc.setLineWidth(0.3); doc.rect(121, y - 1, pageWidth - margin - 121, 22);
    doc.setFontSize(6.8); setTextColor(body); doc.text("INVOICE DATE", 125, y + 5); doc.text("DUE DATE", 125, y + 14);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.2); doc.text(formatInvoiceDate(source.invoiceDate), pageWidth - margin - 4, y + 5, { align: "right" }); doc.text(formatInvoiceDate(source.dueDate), pageWidth - margin - 4, y + 14, { align: "right" });
    y += 28; drawRule(y, 0.35, ink); y += 7;
    if (logoImage) drawContainedImage(logoImage, margin, y - 2, 22, 22);
    const businessX = logoImage ? margin + 28 : margin;
    doc.setFont("helvetica", "bold"); doc.setFontSize(15); setTextColor(ink); doc.text(source.businessName, businessX, y + 5);
    let detailY = y + 11;
    if (source.legalName) { doc.setFontSize(8); doc.text(source.legalName, businessX, detailY); detailY += 5; }
    if (businessContact) { doc.setFont("helvetica", "normal"); doc.setFontSize(7.2); setTextColor(body); doc.text(doc.splitTextToSize(businessContact, 100), businessX, detailY); }
    y += 27;
  } else if (layout.header === "centered-masthead") {
    if (logoImage) drawContainedImage(logoImage, pageWidth / 2 - 10, y - 4, 20, 20);
    const nameY = logoImage ? y + 23 : y + 5;
    doc.setFont("times", "bold"); doc.setFontSize(18); setTextColor(ink); doc.text(source.businessName, pageWidth / 2, nameY, { align: "center" });
    let detailY = nameY + 6;
    if (source.legalName) { doc.setFont("times", "normal"); doc.setFontSize(8); doc.text(source.legalName, pageWidth / 2, detailY, { align: "center" }); detailY += 5; }
    if (businessContact) { doc.setFont("helvetica", "normal"); doc.setFontSize(7); setTextColor(body); doc.text(doc.splitTextToSize(businessContact, 140), pageWidth / 2, detailY, { align: "center" }); detailY += 7; }
    drawRule(detailY, 0.22, ink); drawRule(detailY + 1.5, 0.5, ink);
    doc.setFont("times", "bold"); doc.setFontSize(20); setTextColor(ink); doc.text("INVOICE", pageWidth / 2, detailY + 10, { align: "center" });
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.text(source.invoiceNumber, pageWidth / 2, detailY + 16, { align: "center" });
    y = detailY + 22;
  } else {
    if (logoImage) drawContainedImage(logoImage, margin, y - 1, 27, 27);
    const headerX = logoImage ? margin + 33 : margin;
    doc.setFont("helvetica", "bold"); doc.setFontSize(18); setTextColor(ink); doc.text(source.businessName, headerX, y + 6);
    let detailY = y + 12;
    if (source.legalName) { doc.setFont("helvetica", "normal"); doc.setFontSize(8); setTextColor(body); doc.text(source.legalName, headerX, detailY); detailY += 5; }
    if (businessContact) { doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); setTextColor(body); doc.text(doc.splitTextToSize(businessContact, 78), headerX, detailY); }
    doc.setFont("helvetica", "bold"); doc.setFontSize(22); setTextColor(ink); doc.text("INVOICE", pageWidth - margin, y + 6, { align: "right" });
    doc.setFontSize(9); setTextColor(body); doc.text(source.invoiceNumber, pageWidth - margin, y + 14, { align: "right" });
    y += 31;
  }
  drawRule(y, modernClassic ? 0.55 : 0.22, modernClassic ? ink : rule);
  y += 9;

  const clientTop = y;
  doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); setTextColor(muted); doc.text("BILL TO", margin, clientTop);
  doc.setFontSize(11.5); setTextColor(ink);
  const clientLines: string[] = doc.splitTextToSize(source.clientName, 78);
  doc.text(clientLines, margin, clientTop + 6);
  let clientBottom = clientTop + 6 + clientLines.length * 4.6;
  const clientContact = [source.clientPhone, source.clientEmail].filter(Boolean).join(" | ");
  if (clientContact) {
    const lines: string[] = doc.splitTextToSize(clientContact, 78);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); setTextColor(body); doc.text(lines, margin, clientBottom + 1);
    clientBottom += lines.length * 3.8 + 2;
  }
  if (layout.metadata === "bill-to-split" || layout.metadata === "ruled-columns") {
    const metaX = 126;
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); setTextColor(body); doc.text("INVOICE DATE", metaX, clientTop);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text(formatInvoiceDate(source.invoiceDate), metaX, clientTop + 6);
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.text("DUE DATE", metaX, clientTop + 13);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text(formatInvoiceDate(source.dueDate), metaX, clientTop + 19);
    clientBottom = Math.max(clientBottom, clientTop + 22);
  }
  if (layout.metadata === "boxed-ledger") {
    setDrawColor(ink); doc.setLineWidth(0.25); doc.rect(margin - 3, clientTop - 4, contentWidth + 6, Math.max(24, clientBottom - clientTop + 8));
  }
  y = clientBottom + 7;

  const tableColumns = modernClassic
    ? { itemX: margin + 12, numberX: margin + 3, quantityX: 135, unitX: 164, amountX: pageWidth - margin - 3 }
    : { itemX: margin + 3, numberX: margin + 3, quantityX: 135, unitX: 164, amountX: pageWidth - margin - 3 };
  const drawTableHeader = () => {
    const darkHeader = modernClassic || professional;
    if (darkHeader) setFillColor(ink); else setFillColor(creative ? accentSoft : soft);
    doc.rect(margin, y, contentWidth, 10, "F");
    drawRule(y, 0.25, darkHeader ? ink : rule);
    drawRule(y + 10, 0.25, darkHeader ? ink : rule);
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); setTextColor(darkHeader ? [255, 255, 255] : ink);
    if (modernClassic) doc.text("NO", tableColumns.numberX, y + 6.4);
    doc.text("ITEM", tableColumns.itemX, y + 6.4);
    doc.text("QTY", tableColumns.quantityX, y + 6.4, { align: "right" });
    doc.text("UNIT PRICE", tableColumns.unitX, y + 6.4, { align: "right" });
    doc.text("AMOUNT", tableColumns.amountX, y + 6.4, { align: "right" });
    y += 10;
  };
  drawTableHeader();
  for (const item of source.lineItems) {
    const index = source.lineItems.indexOf(item);
    const itemWidth = modernClassic ? 76 : 88;
    const itemLines: string[] = doc.splitTextToSize(item.item, itemWidth);
    const descLines: string[] = item.description ? doc.splitTextToSize(item.description, itemWidth) : [];
    const height = Math.max(11, 7 + itemLines.length * 3.8 + descLines.length * 3.3);
    if (y + height > contentBottom) { addFlowPage(); drawTableHeader(); }
    const baseline = y + 5.2;
    if (modernClassic) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); setTextColor(muted);
      doc.text(String(index + 1).padStart(2, "0"), tableColumns.numberX, baseline);
    }
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); setTextColor(ink);
    doc.text(itemLines, tableColumns.itemX, baseline);
    if (descLines.length) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); setTextColor(muted);
      doc.text(descLines, tableColumns.itemX, baseline + itemLines.length * 3.8);
    }
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.7); setTextColor(body);
    doc.text(String(item.quantity), tableColumns.quantityX, baseline, { align: "right" });
    doc.text(formatRupiah(item.unitPrice), tableColumns.unitX, baseline, { align: "right" });
    doc.setFont("helvetica", "bold"); setTextColor(ink);
    doc.text(formatRupiah(item.quantity * item.unitPrice), tableColumns.amountX, baseline, { align: "right" });
    y += height;
    drawRule(y, 0.14, rule);
  }
  drawRule(y, modernClassic ? 0.5 : 0.28, modernClassic ? ink : rule);
  y += 7;

  const summaryX = 108;
  const summaryRight = pageWidth - margin;
  const summaryWidth = summaryRight - summaryX;
  const summaryLabelX = summaryX + 5;
  const summaryValueX = summaryRight - 5;
  const adjustmentRows: Array<{ label: string; value: number }> = [
    { label: "Subtotal", value: totals.subtotal },
    ...(totals.discount > 0 ? [{ label: source.discountMode === "percentage" ? `Discount (${source.discountValue}%)` : "Discount", value: -totals.discount }] : []),
    ...(totals.tax > 0 ? [{ label: invoiceTaxLabel(source), value: source.taxTreatment === "deducted" ? -totals.tax : totals.tax }] : []),
  ];
  const grandTotalOffset = 4 + adjustmentRows.length * 4.5 + 0.8;
  const paymentOffset = grandTotalOffset + 11.3;
  const summaryHeight = paymentOffset + (paid > total ? 20.7 : 16.2);
  ensure(summaryHeight + 2);
  const summaryTop = y;
  setFillColor([255, 255, 255]);
  setDrawColor(modernClassic ? ink : creative ? accent : rule);
  doc.setLineWidth(modernClassic ? 0.32 : 0.2);
  if (modernClassic) doc.rect(summaryX, summaryTop, summaryWidth, summaryHeight, "FD");
  else doc.roundedRect(summaryX, summaryTop, summaryWidth, summaryHeight, 1.8, 1.8, "FD");

  let summaryY = summaryTop + 5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.2); setTextColor(muted);
  for (const row of adjustmentRows) {
    doc.text(row.label, summaryLabelX, summaryY);
    doc.setFont("helvetica", "normal"); setTextColor(body);
    doc.text(formatRupiah(row.value), summaryValueX, summaryY, { align: "right" });
    doc.setFont("helvetica", "normal"); setTextColor(muted);
    summaryY += 4.5;
  }

  const grandTotalTop = summaryTop + grandTotalOffset;
  const darkTotal = modernClassic || professional;
  setFillColor(darkTotal ? ink : creative ? accentSoft : soft);
  doc.rect(summaryX, grandTotalTop, summaryWidth, 9, "F");
  if (creative) { setFillColor(accent); doc.rect(summaryX, grandTotalTop, 2, 9, "F"); }
  doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); setTextColor(darkTotal ? [255, 255, 255] : ink);
  doc.text("Grand total", summaryLabelX, grandTotalTop + 5.9);
  doc.setFontSize(11.3);
  doc.text(formatRupiah(total), summaryValueX, grandTotalTop + 5.9, { align: "right" });

  const paymentTop = summaryTop + paymentOffset;
  doc.setFont("helvetica", "bold"); doc.setFontSize(6.4); setTextColor(muted);
  doc.text("PAYMENT SUMMARY", summaryLabelX, paymentTop + 2.3);
  doc.setFont("helvetica", modernClassic && paid > 0 ? "bold" : "normal"); doc.setFontSize(8.3); setTextColor(modernClassic && paid > 0 ? danger : body);
  doc.text(modernClassic ? "Down payment" : "Paid", summaryLabelX, paymentTop + 6.7);
  doc.text(formatRupiah(paid), summaryValueX, paymentTop + 6.7, { align: "right" });
  doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); setTextColor(ink);
  doc.text("Balance due", summaryLabelX, paymentTop + 12.1);
  doc.setFontSize(10.8);
  doc.text(formatRupiah(remaining), summaryValueX, paymentTop + 12.1, { align: "right" });
  if (paid > total) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.8); setTextColor(muted);
    doc.text("Overpaid", summaryLabelX, paymentTop + 16.6);
    doc.text(formatRupiah(paid - total), summaryValueX, paymentTop + 16.6, { align: "right" });
  }
  y = summaryTop + summaryHeight + 4;

  const drawFlowSection = (title: string, value: string, width = contentWidth) => {
    const lines: string[] = doc.splitTextToSize(value, width);
    ensure(10);
    drawRule(y, 0.18, rule);
    y += 5;
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); setTextColor(muted); doc.text(title, margin, y);
    y += 4;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); setTextColor(body);
    for (const line of lines) {
      if (y + 3.8 > contentBottom) {
        addFlowPage();
        doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); setTextColor(muted); doc.text(`${title} - CONTINUED`, margin, y);
        y += 4;
        doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); setTextColor(body);
      }
      doc.text(line, margin, y);
      y += 3.8;
    }
    y += 2;
  };
  if (source.showSchedules && source.schedules.length) {
    const scheduleText = source.schedules.map((schedule) => {
      const start = new Date(schedule.startAt);
      const end = new Date(schedule.endAt);
      const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(start);
      const times = `${start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jakarta" })}-${end.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jakarta" })}`;
      return `${date} | ${times}${schedule.label ? ` | ${schedule.label}` : ""}${schedule.location ? ` | ${schedule.location}` : ""}`;
    }).join("\n");
    drawFlowSection("SCHEDULE", scheduleText);
  }
  if (source.paymentInstructions) drawFlowSection("PAYMENT INSTRUCTIONS", source.paymentInstructions);
  if (source.notes) drawFlowSection("NOTES", source.notes);
  if (signatureImage || stampImage) {
    // Keep a compact signature block on the current page when it fits above
    // the footer. The general flow boundary intentionally leaves more air,
    // but using it here could create an almost-empty continuation page that
    // contained only a signature and stamp.
    const signatureBottom = pageHeight - 15.5;
    if (y + 17 > signatureBottom) addFlowPage();
    drawRule(y, 0.18, rule);
    y += 3.5;
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); setTextColor(muted); doc.text("AUTHORIZED SIGNATURE", margin, y);
    const imageTop = y + 1;
    if (signatureImage) drawContainedImage(signatureImage, margin, imageTop + 2.5, 22, 8);
    if (stampImage) drawContainedImage(stampImage, margin + 11, imageTop, 12, 12);
    y += 13;
  }
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    drawRule(pageHeight - 15, 0.18, rule);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); setTextColor(muted);
    if (settings.showQaiAttribution) doc.text("Created with Qai", margin, pageHeight - 9);
    doc.text(`${page} / ${pageCount}`, pageWidth - margin, pageHeight - 9, { align: "right" });
  }
  doc.setProperties({ title: source.invoiceNumber, subject: `Invoice for ${source.clientName}`, author: source.businessName, creator: "Qai" });
  const filename = `${invoice.invoiceNumber ?? "Draft-invoice"}-${safeFilePart(source.clientName)}.pdf`;
  if (output === "save") { doc.save(filename); return null; }
  return doc.output("blob");
}
