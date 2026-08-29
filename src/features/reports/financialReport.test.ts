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
import { buildFinancialReport } from "./financialReport";
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

  it("reconciles service price, Additional Charges, payments, and direct expenses from the canonical Booking values", () => {
    const chargedBooking: Booking = {
      ...bookings[0],
      servicePrice: 50_000,
      additionalCharges: [{
        id: "charge-1", bookingId: "booking-1", sessionId: null, categoryId: "category-charge",
        categoryName: "Extra assistant", description: "", amount: 25_000, createdAt: 1, updatedAt: 1,
      }],
    };
    const result = buildFinancialReport({
      businessName: "Qai Test", currency: "IDR", timezone: "Asia/Jakarta", period: { preset: "this-month" },
      bookings: [chargedBooking], customers, services,
      payments: [{ ...payments[0], amount: 20_000 }],
      expenses: [{ ...expenses[0], amount: 10_000 }], expenseCategories, invoices: [],
      generatedAt: new Date("2026-08-20T08:00:00.000Z"),
    });
    expect(result.bookings[0]).toMatchObject({ bookingValue: 75_000, totalPaid: 20_000, outstanding: 55_000, directExpenses: 10_000, estimatedJobProfit: 65_000 });
    expect(result.summary).toMatchObject({ expectedBookingValue: 75_000, outstanding: 55_000, estimatedJobProfit: 65_000 });
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
      "Summary", "Income", "Expenses", "Job Profit", "Outstanding", "Bookings", "Schedule", "Invoices",
    ]);
    expect(workbook.getWorksheet("Income")?.getCell("F6").value).toBeTypeOf("number");
    expect(workbook.getWorksheet("Income")?.getCell("A6").value).toBeInstanceOf(Date);
    expect(workbook.getWorksheet("Summary")?.getCell("B6").value).toBe(source.summary.moneyReceived);
    expect(workbook.getWorksheet("Schedule")?.rowCount).toBe(9);
    expect(workbook.getWorksheet("Schedule")?.getCell("B6").value).toBeInstanceOf(Date);
    expect(workbook.getWorksheet("Invoices")?.getCell("A6").value).toBeInstanceOf(Date);
    expect(workbook.getWorksheet("Invoices")?.getCell("L6").value).toBeTypeOf("number");

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
});
