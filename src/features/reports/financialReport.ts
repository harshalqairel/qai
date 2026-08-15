import type { Booking, BookingStatus } from "@/features/booking/types";
import { firstBookingSession, instantParts } from "@/features/booking/utils/bookingSessions";
import type { Customer } from "@/features/customer/types";
import type { ExpenseCategory } from "@/features/expense-category/types";
import type { Expense } from "@/features/expense/types";
import type { Payment } from "@/features/payment/types";
import { calculateBookingFinancials } from "@/features/booking/domain/bookingFinancials";
import type { Service } from "@/features/service/types";
import type { Invoice } from "@/features/invoice/invoice";
import { invoicePaidAmount, invoiceRemainingAmount, invoiceTotals, latestReportableInvoiceVersions } from "@/features/invoice/invoice";

export type ReportPeriodPreset =
  | "this-month"
  | "last-month"
  | "specific-month"
  | "this-year"
  | "all-time"
  | "custom";

export type ReportPeriod = {
  preset: ReportPeriodPreset;
  fromDate: string | null;
  toDate: string | null;
  label: string;
};

export type ReportPeriodInput = {
  preset: ReportPeriodPreset;
  selectedMonth?: string;
  customFrom?: string;
  customTo?: string;
};

export type FinancialReportInput = {
  businessName: string;
  currency: string;
  timezone: string;
  period: ReportPeriodInput;
  bookings: Booking[];
  customers: Customer[];
  services: Service[];
  payments: Payment[];
  expenses: Expense[];
  expenseCategories: ExpenseCategory[];
  invoices?: Invoice[];
  generatedAt?: Date;
};

export type BookingReportRow = {
  bookingId: string;
  firstSessionDate: string;
  customer: string;
  service: string;
  status: BookingStatus;
  sessionCount: number;
  bookingValue: number;
  totalPaid: number;
  outstanding: number | null;
  directExpenses: number;
  estimatedJobProfit: number | null;
  paymentDueDate: string;
  notes: string;
};

export type PaymentReportRow = {
  paymentId: string;
  date: string;
  bookingId: string;
  customer: string;
  service: string;
  bookingStatus: BookingStatus;
  method: string;
  amount: number;
  notes: string;
};

export type ExpenseReportRow = {
  expenseId: string;
  date: string;
  category: string;
  type: Expense["expenseType"];
  bookingId: string | null;
  customer: string;
  service: string;
  vendor: string;
  paymentMethod: string;
  amount: number;
  notes: string;
};

export type ScheduleReportRow = {
  sessionId: string;
  bookingId: string;
  sequence: number;
  label: string;
  sessionContext: string;
  date: string;
  startAt: string;
  endAt: string;
  location: string;
  customer: string;
  service: string;
  bookingStatus: BookingStatus;
  notes: string;
};

export type InvoiceReportRow = {
  rootInvoiceId: string; invoiceId: string; invoiceNumber: string; version: number; lifecycle: Invoice["lifecycle"];
  invoiceDate: string; dueDate: string; client: string; service: string; style: string; subtotal: number; discount: number; tax: number;
  total: number; paid: number; remaining: number; bookingId: string | null;
};

export type FinancialReport = {
  businessName: string;
  currency: string;
  timezone: string;
  generatedAt: string;
  period: ReportPeriod;
  summary: {
    moneyReceived: number;
    expenses: number;
    realizedProfit: number;
    expectedBookingValue: number;
    estimatedJobProfit: number;
    outstanding: number;
    bookings: number;
    scheduledSessions: number;
  };
  moneyReceived: PaymentReportRow[];
  expenses: ExpenseReportRow[];
  jobProfit: BookingReportRow[];
  outstanding: BookingReportRow[];
  bookings: BookingReportRow[];
  schedule: ScheduleReportRow[];
  invoices: InvoiceReportRow[];
};

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function endOfMonth(dateKey: string): string {
  const [year, month] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

function monthLabel(monthKey: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${monthKey}-01T00:00:00.000Z`));
}

function previousMonth(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
}

export function resolveReportPeriod(
  input: ReportPeriodInput,
  timezone: string,
  now = new Date(),
): ReportPeriod {
  const today = instantParts(now.toISOString(), timezone).date;
  if (input.preset === "all-time") {
    return { preset: input.preset, fromDate: null, toDate: null, label: "All Time" };
  }
  if (input.preset === "custom") {
    const fromDate = input.customFrom?.trim() || today;
    const toDate = input.customTo?.trim() || fromDate;
    if (fromDate > toDate) throw new Error("Custom report start date must not be after its end date.");
    return { preset: input.preset, fromDate, toDate, label: `${fromDate} – ${toDate}` };
  }
  if (input.preset === "this-year") {
    const year = today.slice(0, 4);
    return { preset: input.preset, fromDate: `${year}-01-01`, toDate: `${year}-12-31`, label: year };
  }
  const currentMonth = today.slice(0, 7);
  const requestedMonth = input.preset === "last-month"
    ? previousMonth(currentMonth)
    : input.preset === "specific-month"
      ? input.selectedMonth?.trim()
      : currentMonth;
  if (!requestedMonth || !/^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth)) {
    throw new Error("Choose a valid report month.");
  }
  if (input.preset === "specific-month" && requestedMonth > currentMonth) {
    throw new Error("Future months are not available.");
  }
  const fromDate = `${requestedMonth}-01`;
  return {
    preset: input.preset,
    fromDate,
    toDate: endOfMonth(fromDate),
    label: monthLabel(requestedMonth),
  };
}

export function dateIsInReportPeriod(date: string, period: ReportPeriod): boolean {
  if (!period.fromDate || !period.toDate) return true;
  return date >= period.fromDate && date <= period.toDate;
}

export function buildFinancialReport(input: FinancialReportInput): FinancialReport {
  const generatedAt = input.generatedAt ?? new Date();
  const period = resolveReportPeriod(input.period, input.timezone, generatedAt);
  const bookingById = new Map(input.bookings.map((booking) => [booking.id, booking]));
  const customerById = new Map(input.customers.map((customer) => [customer.id, customer]));
  const serviceById = new Map(input.services.map((service) => [service.id, service]));
  const categoryById = new Map(input.expenseCategories.map((category) => [category.id, category]));
  const validPayments = input.payments.filter((payment) => bookingById.has(payment.bookingId));
  const validExpenses = input.expenses.filter((expense) =>
    expense.bookingId === null || bookingById.has(expense.bookingId),
  );

  const nameForBooking = (booking: Booking) => ({
    customer: customerById.get(booking.customerId)?.name ?? "Client not found",
    service: serviceById.get(booking.serviceId)?.name ?? "Service not found",
  });

  const bookingRows = input.bookings
    .map((booking): BookingReportRow | null => {
      const firstSessionDate = instantParts(firstBookingSession(booking).startAt, input.timezone).date;
      if (!dateIsInReportPeriod(firstSessionDate, period)) return null;
      const financials = calculateBookingFinancials(booking, validPayments, validExpenses);
      return {
        bookingId: booking.id,
        firstSessionDate,
        ...nameForBooking(booking),
        status: booking.bookingStatus,
        sessionCount: booking.sessions.length,
        bookingValue: financials.clientTotal,
        totalPaid: financials.totalPaid,
        outstanding: financials.outstanding,
        directExpenses: financials.directExpenses,
        estimatedJobProfit: financials.estimatedJobProfit,
        paymentDueDate: booking.fullPaymentDueDate,
        notes: booking.notes,
      };
    })
    .filter((row): row is BookingReportRow => row !== null)
    .sort((left, right) => left.firstSessionDate.localeCompare(right.firstSessionDate));

  const moneyReceived = validPayments
    .filter((payment) => dateIsInReportPeriod(payment.date, period))
    .map((payment): PaymentReportRow => {
      const booking = bookingById.get(payment.bookingId)!;
      return {
        paymentId: payment.id,
        date: payment.date,
        bookingId: booking.id,
        ...nameForBooking(booking),
        bookingStatus: booking.bookingStatus,
        method: payment.method,
        amount: payment.amount,
        notes: payment.notes,
      };
    })
    .sort((left, right) => left.date.localeCompare(right.date));

  const expenses = validExpenses
    .filter((expense) => dateIsInReportPeriod(expense.date, period))
    .map((expense): ExpenseReportRow => {
      const booking = expense.bookingId ? bookingById.get(expense.bookingId) : undefined;
      const names = booking ? nameForBooking(booking) : { customer: "", service: "" };
      return {
        expenseId: expense.id,
        date: expense.date,
        category: categoryById.get(expense.categoryId)?.name ?? "Category not found",
        type: expense.expenseType,
        bookingId: expense.bookingId,
        ...names,
        vendor: expense.vendor,
        paymentMethod: expense.paymentMethod,
        amount: expense.amount,
        notes: expense.notes,
      };
    })
    .sort((left, right) => left.date.localeCompare(right.date));

  const schedule = input.bookings
    .flatMap((booking) => booking.sessions.map((session): ScheduleReportRow | null => {
      const date = instantParts(session.startAt, input.timezone).date;
      if (!dateIsInReportPeriod(date, period)) return null;
      return {
        sessionId: session.id,
        bookingId: booking.id,
        sequence: session.sequence,
        label: session.label,
        sessionContext: session.label
          ? `Schedule ${session.sequence} - ${session.label}`
          : `Schedule ${session.sequence}`,
        date,
        startAt: session.startAt,
        endAt: session.endAt,
        location: session.location,
        ...nameForBooking(booking),
        bookingStatus: booking.bookingStatus,
        notes: session.notes,
      };
    }))
    .filter((row): row is ScheduleReportRow => row !== null)
    .sort((left, right) => left.startAt.localeCompare(right.startAt));

  const invoices = latestReportableInvoiceVersions(input.invoices ?? [])
    .filter((invoice) => dateIsInReportPeriod(invoice.invoiceDate, period))
    .map((invoice): InvoiceReportRow => {
      const source = invoice.snapshot ?? invoice; const totals = invoiceTotals(source); const paid = invoicePaidAmount(invoice, validPayments);
      return { rootInvoiceId: invoice.rootInvoiceId || invoice.id, invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber ?? "Draft", version: invoice.version,
        lifecycle: invoice.lifecycle, invoiceDate: source.invoiceDate, dueDate: source.dueDate, client: source.clientName, service: source.serviceName,
        style: source.invoiceStyle, subtotal: totals.subtotal, discount: totals.discount, tax: totals.tax, total: totals.total, paid,
        remaining: invoiceRemainingAmount(invoice, validPayments), bookingId: invoice.bookingId };
    }).sort((left, right) => left.invoiceDate.localeCompare(right.invoiceDate));

  const jobProfit = bookingRows.filter((row) => row.estimatedJobProfit !== null);
  const outstanding = bookingRows.filter((row) => row.outstanding !== null && row.outstanding > 0);
  const moneyReceivedTotal = moneyReceived.reduce((sum, row) => sum + row.amount, 0);
  const expenseTotal = expenses.reduce((sum, row) => sum + row.amount, 0);

  return {
    businessName: input.businessName,
    currency: input.currency,
    timezone: input.timezone,
    generatedAt: generatedAt.toISOString(),
    period,
    summary: {
      moneyReceived: moneyReceivedTotal,
      expenses: expenseTotal,
      realizedProfit: moneyReceivedTotal - expenseTotal,
      expectedBookingValue: bookingRows
        .filter((row) => row.status !== "Cancelled")
        .reduce((sum, row) => sum + row.bookingValue, 0),
      estimatedJobProfit: jobProfit.reduce((sum, row) => sum + (row.estimatedJobProfit ?? 0), 0),
      outstanding: outstanding.reduce((sum, row) => sum + (row.outstanding ?? 0), 0),
      bookings: bookingRows.length,
      scheduledSessions: schedule.length,
    },
    moneyReceived,
    expenses,
    jobProfit,
    outstanding,
    bookings: bookingRows,
    schedule,
    invoices,
  };
}

export function reportFilePeriodLabel(report: FinancialReport): string {
  if (report.period.preset === "this-month" && report.period.fromDate) {
    return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
      .format(new Date(`${report.period.fromDate}T00:00:00.000Z`));
  }
  return report.period.label;
}

export function nextDateKey(dateKey: string): string {
  return addDays(dateKey, 1);
}
