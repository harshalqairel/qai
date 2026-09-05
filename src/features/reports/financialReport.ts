import type { Booking, BookingStatus } from "@/features/booking/types";
import { firstBookingSession, instantParts } from "@/features/booking/utils/bookingSessions";
import type { Customer } from "@/features/customer/types";
import type { ExpenseCategory } from "@/features/expense-category/types";
import type { Expense } from "@/features/expense/types";
import type { DerivedPaymentStatus, Payment } from "@/features/payment/types";
import { derivePaymentStatus } from "@/features/payment/utils/paymentCalculations";
import { calculateBookingFinancials } from "@/features/booking/domain/bookingFinancials";
import type { Service } from "@/features/service/types";
import type { Invoice } from "@/features/invoice/invoice";
import { invoicePaidAmount, invoicePaymentStatus, invoiceRemainingAmount, invoiceTotals, latestReportableInvoiceVersions } from "@/features/invoice/invoice";

export type ReportPeriodPreset =
  | "this-month"
  | "last-month"
  | "specific-month"
  | "this-quarter"
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
  serviceId: string;
  firstSessionDate: string;
  customer: string;
  service: string;
  status: BookingStatus;
  paymentStatus: DerivedPaymentStatus;
  sessionCount: number;
  servicePrice: number;
  additionalCharges: number;
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
  total: number; paid: number; remaining: number; paymentStatus: string; bookingId: string | null;
};

export type TopServiceReportRow = {
  serviceId: string;
  service: string;
  bookingCount: number;
  revenue: number;
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
    clientTotal: number;
    paid: number;
    directExpenses: number;
    profit: number;
    bookings: number;
    scheduledSessions: number;
  };
  moneyReceived: PaymentReportRow[];
  expenses: ExpenseReportRow[];
  jobProfit: BookingReportRow[];
  outstanding: BookingReportRow[];
  bookings: BookingReportRow[];
  topServices: TopServiceReportRow[];
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
  if (input.preset === "this-quarter") {
    const year = today.slice(0, 4);
    const month = Number(today.slice(5, 7));
    const quarter = Math.ceil(month / 3);
    const firstMonth = (quarter - 1) * 3 + 1;
    const lastMonth = firstMonth + 2;
    const fromDate = `${year}-${String(firstMonth).padStart(2, "0")}-01`;
    const lastMonthKey = `${year}-${String(lastMonth).padStart(2, "0")}-01`;
    return { preset: input.preset, fromDate, toDate: endOfMonth(lastMonthKey), label: `Q${quarter} ${year}` };
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

export function rankTopServices(rows: readonly BookingReportRow[]): TopServiceReportRow[] {
  const byService = new Map<string, TopServiceReportRow>();
  for (const row of rows) {
    if (row.status === "Cancelled") continue;
    const current = byService.get(row.serviceId);
    if (current) {
      current.bookingCount += 1;
      current.revenue += row.bookingValue;
      continue;
    }
    byService.set(row.serviceId, {
      serviceId: row.serviceId,
      service: row.service,
      bookingCount: 1,
      revenue: row.bookingValue,
    });
  }
  return [...byService.values()].sort((left, right) =>
    right.revenue - left.revenue ||
    right.bookingCount - left.bookingCount ||
    left.service.localeCompare(right.service) ||
    left.serviceId.localeCompare(right.serviceId),
  );
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
    service: booking.serviceSnapshot?.serviceName || serviceById.get(booking.serviceId)?.name || "Service not found",
  });
  const todayKey = instantParts(generatedAt.toISOString(), input.timezone).date;

  const bookingRows = input.bookings
    .map((booking): BookingReportRow | null => {
      const firstSessionDate = instantParts(firstBookingSession(booking).startAt, input.timezone).date;
      if (!dateIsInReportPeriod(firstSessionDate, period)) return null;
      const financials = calculateBookingFinancials(booking, validPayments, validExpenses);
      return {
        bookingId: booking.id,
        serviceId: booking.serviceId,
        firstSessionDate,
        ...nameForBooking(booking),
        status: booking.bookingStatus,
        paymentStatus: derivePaymentStatus(
          booking.bookingStatus,
          financials.totalPaid,
          financials.clientTotal,
          booking.fullPaymentDueDate,
          todayKey,
        ),
        sessionCount: booking.sessions.length,
        servicePrice: financials.servicePrice,
        additionalCharges: financials.additionalCharges,
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
        remaining: invoiceRemainingAmount(invoice, validPayments), paymentStatus: invoicePaymentStatus(totals.total, paid, source.dueDate, todayKey), bookingId: invoice.bookingId };
    }).sort((left, right) => left.invoiceDate.localeCompare(right.invoiceDate));

  const jobProfit = bookingRows.filter((row) => row.estimatedJobProfit !== null);
  const outstanding = bookingRows.filter((row) => row.outstanding !== null && row.outstanding > 0);
  const moneyReceivedTotal = moneyReceived.reduce((sum, row) => sum + row.amount, 0);
  const expenseTotal = expenses.reduce((sum, row) => sum + row.amount, 0);
  const activeBookingRows = bookingRows.filter((row) => row.status !== "Cancelled");
  const clientTotal = activeBookingRows.reduce((sum, row) => sum + row.bookingValue, 0);
  const paid = activeBookingRows.reduce((sum, row) => sum + row.totalPaid, 0);
  const directExpenses = activeBookingRows.reduce((sum, row) => sum + row.directExpenses, 0);
  const profit = clientTotal - directExpenses;
  const topServices = rankTopServices(bookingRows);

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
      expectedBookingValue: clientTotal,
      estimatedJobProfit: profit,
      outstanding: outstanding.reduce((sum, row) => sum + (row.outstanding ?? 0), 0),
      clientTotal,
      paid,
      directExpenses,
      profit,
      bookings: bookingRows.length,
      scheduledSessions: schedule.length,
    },
    moneyReceived,
    expenses,
    jobProfit,
    outstanding,
    bookings: bookingRows,
    topServices,
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
