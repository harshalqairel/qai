import { describe, expect, it } from "vitest";
import { writeFile } from "node:fs/promises";
import { Workbook } from "exceljs";
import type { Booking } from "@/features/booking/types";
import type { Customer } from "@/features/customer/types";
import type { Expense } from "@/features/expense/types";
import type { Payment } from "@/features/payment/types";
import type { Service } from "@/features/service/types";
import type { ExpenseCategory } from "@/features/expense-category/types";
import { buildFinancialReport } from "./financialReport";
import { buildFinancialReportWorkbook } from "./excelExport";
import { uploadFinancialReportWorkbookToGoogleSheets } from "./googleSheetsExport";

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

  it("counts a multi-session booking once financially and once per session in Schedule", () => {
    const result = report();
    expect(result.bookings.filter((row) => row.bookingId === "booking-1")).toHaveLength(1);
    expect(result.schedule.filter((row) => row.bookingId === "booking-1")).toHaveLength(3);
    expect(result.summary.bookings).toBe(2);
    expect(result.summary.scheduledSessions).toBe(4);
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
      "Summary", "Income", "Expenses", "Job Profit", "Outstanding", "Bookings", "Schedule",
    ]);
    expect(workbook.getWorksheet("Income")?.getCell("F6").value).toBeTypeOf("number");
    expect(workbook.getWorksheet("Income")?.getCell("A6").value).toBeInstanceOf(Date);
    expect(workbook.getWorksheet("Summary")?.getCell("B6").value).toBe(source.summary.moneyReceived);
    expect(workbook.getWorksheet("Schedule")?.rowCount).toBe(9);
  });
});

describe("Google Sheets snapshot export", () => {
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
});
