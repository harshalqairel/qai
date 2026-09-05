import { describe, expect, it } from "vitest";
import { writeFile } from "node:fs/promises";
import { Workbook } from "exceljs";
import type { Booking } from "@/features/booking/types";
import type { Customer } from "@/features/customer/types";
import type { Expense } from "@/features/expense/types";
import type { Payment } from "@/features/payment/types";
import type { Service } from "@/features/service/types";
import type { ExpenseCategory } from "@/features/expense-category/types";
import { createInvoiceRevision, DEFAULT_INVOICE_SETTINGS, issueInvoice, type Invoice } from "@/features/invoice/invoice";
import { buildFinancialReport, rankTopServices } from "./financialReport";
import { buildFinancialReportWorkbook } from "./excelExport";
import { uploadFinancialReportWorkbookToGoogleDrive, uploadFinancialReportWorkbookToGoogleSheets } from "./googleSheetsExport";

const customers: Customer[] = [
  { id: "customer-1", name: "Ayu", phone: "", instagram: "", email: "", notes: "", createdAt: 1 },
];
const services: Service[] = [
  { id: "service-1", name: "Wedding", categoryId: "service-category-1", price: 1_000_000, duration: 120, defaultSessionCount: 3, description: "", active: true },
];
const expenseCategories: ExpenseCategory[] = [
  { id: "expense-category-1", name: "Supplies", color: "#0D5C5A", active: true, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
];

function session(bookingId: string, sequence: number, date: string) {
  return {
    id: `${bookingId}-session-${sequence}`,
    bookingId,
    sequence,
    label: sequence === 1 ? "Akad" : "",
    startAt: `${date}T02:00:00.000Z`,
    endAt: `${date}T04:00:00.000Z`,
    location: "Jakarta",
    notes: "",
    createdAt: 1,
    updatedAt: 1,
  };
}

const bookings: Booking[] = [
  {
    id: "booking-1",
    customerId: "customer-1",
    serviceId: "service-1",
    sessions: [session("booking-1", 1, "2026-08-12"), session("booking-1", 2, "2026-08-15"), session("booking-1", 3, "2026-08-20")],
    servicePrice: 1_000_000,
    bookingStatus: "Scheduled",
    fullPaymentDueDate: "2026-08-25",
    notes: "",
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: "booking-2",
    customerId: "customer-1",
    serviceId: "service-1",
    sessions: [session("booking-2", 1, "2026-08-10")],
    servicePrice: 500_000,
    bookingStatus: "Cancelled",
    fullPaymentDueDate: "2026-08-10",
    notes: "",
    createdAt: 1,
    updatedAt: 1,
  },
];

const payments: Payment[] = [
  { id: "payment-1", bookingId: "booking-1", date: "2026-08-12", amount: 300_000, method: "Bank Transfer", notes: "", createdAt: 1 },
  { id: "payment-2", bookingId: "booking-2", date: "2026-08-11", amount: 200_000, method: "Cash", notes: "Kept after cancellation", createdAt: 1 },
];

const expenses: Expense[] = [
  { id: "expense-1", date: "2026-08-13", categoryId: "expense-category-1", amount: 100_000, paymentMethod: "Cash", expenseType: "Booking Expense", bookingId: "booking-1", vendor: "Vendor", notes: "", createdAt: 1, updatedAt: 1 },
  { id: "expense-2", date: "2026-08-14", categoryId: "expense-category-1", amount: 50_000, paymentMethod: "Cash", expenseType: "Business Expense", bookingId: null, vendor: "Office", notes: "", createdAt: 1, updatedAt: 1 },
];

const invoiceDraft: Invoice = {
  id: "invoice-1", rootInvoiceId: "invoice-1", previousVersionId: null, version: 1, businessId: "local-business", bookingId: "booking-1", clientId: "customer-1", lifecycle: "Draft", invoiceNumber: null,
  clientName: "Ayu", clientPhone: "", clientEmail: "", serviceName: "Wedding", invoiceDate: "2026-08-12", dueDate: "2026-08-25",
  lineItems: [{ id: "line-1", item: "Wedding", description: "", quantity: 1, unitPrice: 1_000_000 }], discount: 0, tax: 0, discountMode: "none", discountValue: 0, taxPercent: 0,
  invoiceStyle: "Professional", paymentInstructions: "", notes: "", schedules: [], showSchedules: true, snapshot: null, createdAt: 1, updatedAt: 1, issuedAt: null,
};
const issuedInvoice = issueInvoice(invoiceDraft, { ...DEFAULT_INVOICE_SETTINGS, businessName: "Qai Test" }, [], Date.UTC(2026, 7, 12));
const invoiceRevisionDraft = createInvoiceRevision(issuedInvoice, Date.UTC(2026, 7, 13));

function report(period: Parameters<typeof buildFinancialReport>[0]["period"] = { preset: "this-month" }) {
  return buildFinancialReport({
    businessName: "Qai Test",
    currency: "IDR",
    timezone: "Asia/Jakarta",
    period,
    bookings,
    customers,
    services,
    payments,
    expenses,
    expenseCategories,
    invoices: [issuedInvoice, invoiceRevisionDraft],
    generatedAt: new Date("2026-08-20T08:00:00.000Z"),
  });
}

function validationBooking(args: {
  id: string;
  serviceId: string;
  serviceName: string;
  date: string;
  servicePrice: number;
  additionalCharge?: number;
  dueDate?: string;
  status?: Booking["bookingStatus"];
}): Booking {
  return {
    id: args.id,
    customerId: "customer-1",
    serviceId: args.serviceId,
    sessions: [session(args.id, 1, args.date)],
    servicePrice: args.servicePrice,
    serviceSnapshot: {
      serviceName: args.serviceName,
      variantId: null,
      variantLabel: "",
      options: [],
      price: args.servicePrice,
      duration: 60,
      defaultSessionCount: 1,
    },
    additionalCharges: args.additionalCharge ? [{
      id: `${args.id}-charge`,
      bookingId: args.id,
      sessionId: null,
      categoryId: "travel",
      categoryName: "Travel",
      description: "Client-facing travel charge",
      amount: args.additionalCharge,
      createdAt: 1,
      updatedAt: 1,
    }] : [],
    bookingStatus: args.status ?? "Scheduled",
    fullPaymentDueDate: args.dueDate ?? "2026-09-30",
    notes: "",
    createdAt: 1,
    updatedAt: 1,
  };
}

function controlledReport(period: Parameters<typeof buildFinancialReport>[0]["period"] = { preset: "specific-month", selectedMonth: "2026-09" }) {
  const controlledBookings = [
    validationBooking({ id: "report-a", serviceId: "service-a", serviceName: "REPORT-VALIDATION-WEDDING", date: "2026-09-05", servicePrice: 7_500_000, additionalCharge: 500_000 }),
    validationBooking({ id: "report-b", serviceId: "service-a", serviceName: "REPORT-VALIDATION-WEDDING", date: "2026-09-06", servicePrice: 5_000_000, additionalCharge: 1_000_000 }),
    validationBooking({ id: "report-c", serviceId: "service-b", serviceName: "REPORT-VALIDATION-STUDIO", date: "2026-09-07", servicePrice: 3_000_000 }),
    validationBooking({ id: "report-d", serviceId: "service-c", serviceName: "REPORT-VALIDATION-CLASS", date: "2026-09-08", servicePrice: 4_000_000, dueDate: "2026-09-10" }),
    validationBooking({ id: "report-e", serviceId: "service-c", serviceName: "REPORT-VALIDATION-CLASS", date: "2026-09-09", servicePrice: 9_000_000, status: "Cancelled" }),
    validationBooking({ id: "report-f", serviceId: "service-b", serviceName: "REPORT-VALIDATION-STUDIO", date: "2026-08-31", servicePrice: 10_000_000 }),
  ];
  const controlledPayments: Payment[] = [
    { id: "pay-b", bookingId: "report-b", date: "2026-09-06", amount: 2_000_000, method: "Bank Transfer", notes: "", createdAt: 1 },
    { id: "pay-c", bookingId: "report-c", date: "2026-09-07", amount: 3_000_000, method: "Cash", notes: "", createdAt: 1 },
    { id: "pay-d", bookingId: "report-d", date: "2026-09-08", amount: 1_000_000, method: "QRIS", notes: "", createdAt: 1 },
    { id: "pay-e", bookingId: "report-e", date: "2026-09-09", amount: 500_000, method: "Cash", notes: "Cancelled history", createdAt: 1 },
  ];
  const controlledExpenses: Expense[] = [
    { id: "expense-b", date: "2026-09-06", categoryId: "expense-category-1", amount: 500_000, paymentMethod: "Cash", expenseType: "Booking Expense", bookingId: "report-b", vendor: "Artist", notes: "", createdAt: 1, updatedAt: 1 },
    { id: "expense-c", date: "2026-09-07", categoryId: "expense-category-1", amount: 250_000, paymentMethod: "Cash", expenseType: "Booking Expense", bookingId: "report-c", vendor: "Studio", notes: "", createdAt: 1, updatedAt: 1 },
    { id: "expense-e", date: "2026-09-09", categoryId: "expense-category-1", amount: 100_000, paymentMethod: "Cash", expenseType: "Booking Expense", bookingId: "report-e", vendor: "Cancelled", notes: "", createdAt: 1, updatedAt: 1 },
    { id: "expense-business", date: "2026-09-10", categoryId: "expense-category-1", amount: 200_000, paymentMethod: "Cash", expenseType: "Business Expense", bookingId: null, vendor: "Office", notes: "", createdAt: 1, updatedAt: 1 },
  ];
  return buildFinancialReport({
    businessName: "Qai Report Validation",
    currency: "IDR",
    timezone: "Asia/Jakarta",
    period,
    bookings: controlledBookings,
    customers,
    services: [
      { id: "service-a", name: "RENAMED-LIVE-SERVICE", categoryId: "service-category-1", price: 1, duration: 60, defaultSessionCount: 1, description: "", active: true },
      { id: "service-c", name: "REPORT-VALIDATION-CLASS", categoryId: "service-category-1", price: 4_000_000, duration: 60, defaultSessionCount: 1, description: "", active: false },
    ],
    payments: controlledPayments,
    expenses: controlledExpenses,
    expenseCategories,
    generatedAt: new Date("2026-09-15T17:30:00.000Z"),
  });
}

async function uploadedWorkbook(body: Blob): Promise<Workbook> {
  const multipart = Buffer.from(await body.arrayBuffer());
  const workbookStart = multipart.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  const workbookEnd = multipart.indexOf(Buffer.from("\r\n--qai_"), workbookStart);
  expect(workbookStart).toBeGreaterThan(-1);
  expect(workbookEnd).toBeGreaterThan(workbookStart);
  const workbook = new Workbook();
  const workbookBytes = multipart.subarray(workbookStart, workbookEnd);
  await workbook.xlsx.load(workbookBytes.buffer.slice(
    workbookBytes.byteOffset,
    workbookBytes.byteOffset + workbookBytes.byteLength,
  ) as ArrayBuffer);
  return workbook;
}

describe("financial reporting domain", () => {
  it("applies This Month, This Year, All Time, and inclusive custom boundaries", () => {
    expect(report().summary.moneyReceived).toBe(500_000);
    expect(report({ preset: "this-year" }).summary.bookings).toBe(2);
    expect(report({ preset: "all-time" }).schedule).toHaveLength(4);
    const custom = report({ preset: "custom", customFrom: "2026-08-12", customTo: "2026-08-15" });
    expect(custom.schedule.map((row) => row.date)).toEqual(["2026-08-12", "2026-08-15"]);
  });

  it("resolves Last Month and a historical specific month without exposing enum labels", () => {
    const lastMonth = report({ preset: "last-month" });
    expect(lastMonth.period).toMatchObject({ fromDate: "2026-07-01", toDate: "2026-07-31", label: "July 2026" });
    const selected = report({ preset: "specific-month", selectedMonth: "2025-12" });
    expect(selected.period.label).toBe("December 2025");
    expect(() => report({ preset: "specific-month", selectedMonth: "2026-09" })).toThrow(/Future months/);
  });

  it("resolves the current business-local quarter", () => {
    expect(report({ preset: "this-quarter" }).period).toEqual({
      preset: "this-quarter",
      fromDate: "2026-07-01",
      toDate: "2026-09-30",
      label: "Q3 2026",
    });
  });

  it("keeps cancelled financial history but excludes cancelled outstanding and job profit", () => {
    const result = report();
    const cancelled = result.bookings.find((row) => row.bookingId === "booking-2");
    expect(cancelled?.outstanding).toBeNull();
    expect(cancelled?.estimatedJobProfit).toBeNull();
    expect(result.outstanding.map((row) => row.bookingId)).not.toContain("booking-2");
    expect(result.moneyReceived.find((row) => row.paymentId === "payment-2")?.amount).toBe(200_000);
  });

  it("does not let general expenses alter booking estimated profit", () => {
    const active = report().jobProfit.find((row) => row.bookingId === "booking-1");
    expect(active?.directExpenses).toBe(100_000);
    expect(active?.estimatedJobProfit).toBe(900_000);
  });

  it("counts a multi-session booking once financially and once per session in Schedule", () => {
    const result = report();
    expect(result.bookings.filter((row) => row.bookingId === "booking-1")).toHaveLength(1);
    expect(result.schedule.filter((row) => row.bookingId === "booking-1")).toHaveLength(3);
    expect(result.summary.bookings).toBe(2);
    expect(result.summary.scheduledSessions).toBe(4);
  });

  it("reports one issued Invoice version without adding Invoice total to Income", () => {
    const result = report();
    expect(result.invoices).toMatchObject([{ invoiceNumber: "INV-2026-0001", version: 1, lifecycle: "Issued", total: 1_000_000, paid: 300_000 }]);
    expect(result.summary.moneyReceived).toBe(500_000);
  });
});

describe("canonical report reconciliation", () => {
  it("uses persisted service price plus Additional Charges for Client Total", () => {
    const result = controlledReport();
    const row = result.bookings.find((booking) => booking.bookingId === "report-a");
    expect(row).toMatchObject({ servicePrice: 7_500_000, additionalCharges: 500_000, bookingValue: 8_000_000 });
  });

  it("does not classify Additional Charges as Expenses", () => {
    const result = controlledReport();
    expect(result.expenses.map((expense) => expense.expenseId)).not.toContain("report-a-charge");
    expect(result.summary.expenses).toBe(1_050_000);
  });

  it("reconciles Paid and Outstanding from persisted Payment rows", () => {
    const result = controlledReport();
    expect(result.summary.paid).toBe(6_000_000);
    expect(result.summary.outstanding).toBe(15_000_000);
    expect(result.bookings.find((row) => row.bookingId === "report-b")).toMatchObject({ totalPaid: 2_000_000, outstanding: 4_000_000 });
  });

  it("derives Overdue without changing any financial total", () => {
    const result = controlledReport();
    expect(result.bookings.find((row) => row.bookingId === "report-d")).toMatchObject({ paymentStatus: "Overdue", bookingValue: 4_000_000, totalPaid: 1_000_000, outstanding: 3_000_000, estimatedJobProfit: 4_000_000 });
  });

  it("uses direct Booking Expenses for Profit and excludes general business Expenses", () => {
    const result = controlledReport();
    expect(result.summary).toMatchObject({ clientTotal: 21_000_000, directExpenses: 750_000, profit: 20_250_000 });
    expect(result.summary.estimatedJobProfit).toBe(result.summary.profit);
  });

  it("keeps cancelled transaction history but excludes cancelled booking value, profit, outstanding, and service ranking", () => {
    const result = controlledReport();
    expect(result.summary.moneyReceived).toBe(6_500_000);
    expect(result.summary.realizedProfit).toBe(5_450_000);
    expect(result.bookings.find((row) => row.bookingId === "report-e")?.paymentStatus).toBe("Cancelled");
    expect(result.topServices.find((service) => service.serviceId === "service-c")).toMatchObject({ bookingCount: 1, revenue: 4_000_000 });
  });

  it("ranks Top Services by Client Total, then booking count and stable name", () => {
    const result = controlledReport();
    expect(result.topServices).toEqual([
      { serviceId: "service-a", service: "REPORT-VALIDATION-WEDDING", bookingCount: 2, revenue: 14_000_000 },
      { serviceId: "service-c", service: "REPORT-VALIDATION-CLASS", bookingCount: 1, revenue: 4_000_000 },
      { serviceId: "service-b", service: "REPORT-VALIDATION-STUDIO", bookingCount: 1, revenue: 3_000_000 },
    ]);
  });

  it("applies deterministic Top Services tie-breakers", () => {
    const rows = controlledReport().bookings.filter((row) => row.status !== "Cancelled").map((row) => ({ ...row, bookingValue: 1_000 }));
    expect(rankTopServices(rows).map((row) => row.serviceId)).toEqual(["service-a", "service-c", "service-b"]);
  });

  it("uses service snapshots when a live Service is renamed, deleted, or deactivated", () => {
    const result = controlledReport();
    expect(result.bookings.find((row) => row.bookingId === "report-a")?.service).toBe("REPORT-VALIDATION-WEDDING");
    expect(result.bookings.find((row) => row.bookingId === "report-c")?.service).toBe("REPORT-VALIDATION-STUDIO");
    expect(result.bookings.find((row) => row.bookingId === "report-d")?.service).toBe("REPORT-VALIDATION-CLASS");
  });

  it("never replaces persisted Booking revenue with the live Service price", () => {
    expect(controlledReport().topServices[0]?.revenue).toBe(14_000_000);
  });

  it("excludes Bookings outside the selected month and includes them in quarter and year periods", () => {
    expect(controlledReport().bookings.map((row) => row.bookingId)).not.toContain("report-f");
    expect(controlledReport({ preset: "this-quarter" }).bookings.map((row) => row.bookingId)).toContain("report-f");
    expect(controlledReport({ preset: "this-year" }).bookings.map((row) => row.bookingId)).toContain("report-f");
  });

  it("uses the active Booking cohort for average-value inputs", () => {
    const result = controlledReport();
    const activeBookings = result.bookings.filter((row) => row.status !== "Cancelled");
    expect(result.summary.clientTotal / activeBookings.length).toBe(5_250_000);
  });

  it("returns an empty service ranking and zero booking totals for an empty period", () => {
    const result = controlledReport({ preset: "specific-month", selectedMonth: "2026-07" });
    expect(result.topServices).toEqual([]);
    expect(result.summary).toMatchObject({ clientTotal: 0, paid: 0, outstanding: 0, directExpenses: 0, profit: 0 });
  });

  it("uses the business-local generated date for exported payment status", () => {
    const dueToday = validationBooking({ id: "boundary", serviceId: "service-a", serviceName: "Boundary", date: "2026-09-16", servicePrice: 1_000, dueDate: "2026-09-16" });
    const result = buildFinancialReport({ businessName: "Qai", currency: "IDR", timezone: "Asia/Jakarta", period: { preset: "this-month" }, bookings: [dueToday], customers, services, payments: [], expenses: [], expenseCategories, generatedAt: new Date("2026-09-15T17:30:00.000Z") });
    expect(result.bookings[0]?.paymentStatus).toBe("Outstanding");
  });
});

describe("Excel export", () => {
  it("creates a readable workbook with numeric currency cells, real dates, and equivalent totals", async () => {
    const source = report();
    const bytes = await buildFinancialReportWorkbook(source);
    if (process.env.QAI_REPORT_FIXTURE_PATH) {
      await writeFile(process.env.QAI_REPORT_FIXTURE_PATH, Buffer.from(bytes));
    }
    const workbook = new Workbook();
    await workbook.xlsx.load(bytes);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Summary", "Top Services", "Income", "Expenses", "Job Profit", "Outstanding", "Bookings", "Schedule", "Invoices",
    ]);
    expect(workbook.getWorksheet("Income")?.getCell("F6").value).toBeTypeOf("number");
    expect(workbook.getWorksheet("Income")?.getCell("A6").value).toBeInstanceOf(Date);
    expect(workbook.getWorksheet("Summary")?.getCell("B6").value).toBe(source.summary.moneyReceived);
    expect(workbook.getWorksheet("Schedule")?.rowCount).toBe(9);
    expect(workbook.getWorksheet("Schedule")?.getCell("B6").value).toBeInstanceOf(Date);
    expect(workbook.getWorksheet("Invoices")?.getCell("A6").value).toBeInstanceOf(Date);
    expect(workbook.getWorksheet("Invoices")?.getCell("L6").value).toBeTypeOf("number");
    expect(workbook.getWorksheet("Bookings")?.getRow(5).values).toContain("Payment Status");
    expect(workbook.getWorksheet("Bookings")?.getRow(5).values).toContain("Additional Charges");
    expect(workbook.getWorksheet("Top Services")?.getCell("D6").value).toBe(source.topServices[0]?.revenue);

    for (const sheet of workbook.worksheets) {
      const headers = sheet.getRow(5).values as unknown[];
      expect(headers).not.toContain("Booking ID");
      expect(headers).not.toContain("Session ID");
      expect(headers).not.toContain("Payment ID");
      expect(headers).not.toContain("Expense ID");
    }
    expect(workbook.getWorksheet("Income")?.getRow(5).values).toEqual([
      undefined,
      "Date",
      "Client",
      "Service",
      "Booking Status",
      "Payment Method",
      "Amount",
      "Notes",
    ]);
    expect(workbook.getWorksheet("Schedule")?.getRow(5).values).toEqual([
      undefined,
      "Date",
      "Start Time",
      "End Time",
      "Client",
      "Service",
      "Location",
      "Booking Status",
      "Schedule",
      "Notes",
    ]);
  });

  it("maps the canonical Booking financial fields and Overdue status as typed values", async () => {
    const source = controlledReport();
    const workbook = new Workbook();
    const bytes = await buildFinancialReportWorkbook(source);
    if (process.env.QAI_CONTROLLED_REPORT_FIXTURE_PATH) {
      await writeFile(process.env.QAI_CONTROLLED_REPORT_FIXTURE_PATH, Buffer.from(bytes));
    }
    await workbook.xlsx.load(bytes);
    const bookingSheet = workbook.getWorksheet("Bookings")!;
    const headers = bookingSheet.getRow(5).values as unknown[];
    const column = (name: string) => headers.indexOf(name);
    const overdueRow = bookingSheet.getRows(6, source.bookings.length)?.find((row) => row.getCell(column("Service")).value === "REPORT-VALIDATION-CLASS" && row.getCell(column("Booking Status")).value !== "Cancelled");
    expect(overdueRow?.getCell(column("Payment Status")).value).toBe("Overdue");
    expect(overdueRow?.getCell(column("Service Price")).value).toBe(4_000_000);
    const firstRow = bookingSheet.getRow(6);
    expect(firstRow.getCell(column("Additional Charges")).value).toBe(500_000);
    expect(firstRow.getCell(column("Client Total")).value).toBe(8_000_000);
    expect(bookingSheet.getRow(11).getCell(column("Client Total")).value).toBe(source.summary.clientTotal);
    expect(workbook.getWorksheet("Summary")?.getCell("B13").value).toBe(source.summary.profit);
  });
});

describe("Google Sheets snapshot export", () => {
  it("uses only the app-created-file Google Drive scope", async () => {
    const { GOOGLE_REPORT_SCOPE } = await import("./googleSheetsExport");
    expect(GOOGLE_REPORT_SCOPE).toBe("https://www.googleapis.com/auth/drive.file");
  });
  it("uploads the same real workbook as a newly created spreadsheet on every export", async () => {
    const requests: Array<{ url: string; options?: RequestInit }> = [];
    const fakeFetch = (async (url: string | URL | Request, options?: RequestInit) => {
      requests.push({ url: url.toString(), options });
      const exportNumber = requests.length;
      return new Response(JSON.stringify({ id: `sheet-${exportNumber}` }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const source = report();
    const first = await uploadFinancialReportWorkbookToGoogleSheets(source, "test-token", fakeFetch);
    const second = await uploadFinancialReportWorkbookToGoogleSheets(source, "test-token", fakeFetch);

    expect(first).toContain("/sheet-1/edit");
    expect(second).toContain("/sheet-2/edit");
    expect(requests).toHaveLength(2);
    for (const request of requests) {
      expect(request.url).toContain("/upload/drive/v3/files?uploadType=multipart");
      expect(request.options?.method).toBe("POST");
      expect(request.options?.headers).toMatchObject({ Authorization: "Bearer test-token" });
      expect(await (request.options?.body as Blob).text()).toContain("application/vnd.google-apps.spreadsheet");
    }
  });

  it("uploads the identical numeric XLSX workbook to Drive without converting it", async () => {
    let body: Blob | null = null;
    const fakeFetch = (async (_url: string | URL | Request, options?: RequestInit) => {
      body = options?.body as Blob;
      return new Response(JSON.stringify({ id: "drive-file" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;
    const url = await uploadFinancialReportWorkbookToGoogleDrive(report(), "test-token", fakeFetch);
    expect(url).toContain("/drive-file/view");
    expect(await body!.text()).toContain("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(await body!.text()).not.toContain("application/vnd.google-apps.spreadsheet");
  });

  it("uses the same canonical workbook rows for Google Sheets and Drive", async () => {
    const bodies: Blob[] = [];
    const fakeFetch = (async (_url: string | URL | Request, options?: RequestInit) => {
      bodies.push(options?.body as Blob);
      return new Response(JSON.stringify({ id: `file-${bodies.length}` }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;
    const source = controlledReport();
    await uploadFinancialReportWorkbookToGoogleSheets(source, "test-token", fakeFetch);
    await uploadFinancialReportWorkbookToGoogleDrive(source, "test-token", fakeFetch);
    const [sheetsWorkbook, driveWorkbook] = await Promise.all(bodies.map(uploadedWorkbook));
    for (const workbook of [sheetsWorkbook, driveWorkbook]) {
      expect(workbook.getWorksheet("Summary")?.getCell("B13").value).toBe(source.summary.profit);
      expect(workbook.getWorksheet("Top Services")?.getCell("D6").value).toBe(14_000_000);
      expect(workbook.getWorksheet("Bookings")?.getRow(5).values).toContain("Payment Status");
    }
  });
});
