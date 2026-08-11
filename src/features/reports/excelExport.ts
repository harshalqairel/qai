import type { Cell, Row, Worksheet } from "exceljs";
import type { FinancialReport } from "./financialReport";
import { reportFilePeriodLabel } from "./financialReport";
import { instantParts } from "@/features/booking/utils/bookingSessions";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const HEADER_FILL = "0D5C5A";
const HEADER_TEXT = "FFFFFF";
const SOFT_FILL = "E7F3F2";

type SheetColumn = {
  header: string;
  key: string;
  width: number;
  kind?: "currency" | "date" | "datetime" | "number" | "time";
};

function spreadsheetDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function styleMetadata(sheet: Worksheet, report: FinancialReport, lastColumn: number) {
  sheet.mergeCells(1, 1, 1, lastColumn);
  sheet.getCell(1, 1).value = report.businessName;
  sheet.getCell(1, 1).font = { bold: true, size: 16, color: { argb: HEADER_FILL } };
  sheet.mergeCells(2, 1, 2, lastColumn);
  sheet.getCell(2, 1).value = `Report period: ${report.period.label} · Timezone: ${report.timezone}`;
  sheet.getCell(2, 1).font = { color: { argb: "475569" } };
  sheet.mergeCells(3, 1, 3, lastColumn);
  sheet.getCell(3, 1).value = `Generated: ${new Date(report.generatedAt).toLocaleString("en-GB", { timeZone: report.timezone })}`;
  sheet.getCell(3, 1).font = { italic: true, color: { argb: "64748B" } };
  sheet.getRow(1).height = 24;
}

function styleHeader(row: Row) {
  row.height = 24;
  row.eachCell((cell: Cell) => {
    cell.font = { bold: true, color: { argb: HEADER_TEXT } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
  });
}

function addDataSheet(
  workbook: import("exceljs").Workbook,
  report: FinancialReport,
  name: string,
  columns: SheetColumn[],
  rows: Record<string, unknown>[],
  totalKeys: string[] = [],
) {
  const sheet = workbook.addWorksheet(name, { views: [{ state: "frozen", ySplit: 5 }] });
  sheet.properties.defaultRowHeight = 20;
  styleMetadata(sheet, report, columns.length);
  const headerRow = sheet.getRow(5);
  columns.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = column.header;
    sheet.getColumn(index + 1).width = column.width;
  });
  styleHeader(headerRow);

  for (const source of rows) {
    const values = columns.map((column) => {
      const value = source[column.key];
      if ((column.kind === "date" || column.kind === "datetime") && typeof value === "string" && value) {
        if (column.kind === "date") return spreadsheetDate(value);
        const parts = instantParts(value, report.timezone);
        return new Date(`${parts.date}T${parts.time}:00.000Z`);
      }
      if (column.kind === "time" && typeof value === "string" && value) {
        const { time } = instantParts(value, report.timezone);
        return new Date(`1899-12-30T${time}:00.000Z`);
      }
      return value === "" || value == null ? null : value;
    });
    const row = sheet.addRow(values);
    columns.forEach((column, index) => {
      const cell = row.getCell(index + 1);
      if (column.kind === "currency") cell.numFmt = `"${report.currency}" #,##0.00;[Red]-"${report.currency}" #,##0.00`;
      if (column.kind === "number") cell.numFmt = "#,##0";
      if (column.kind === "date") cell.numFmt = "yyyy-mm-dd";
      if (column.kind === "datetime") cell.numFmt = "yyyy-mm-dd hh:mm";
      if (column.kind === "time") cell.numFmt = "hh:mm";
      cell.alignment = { vertical: "top", wrapText: false };
    });
  }

  if (rows.length > 0 && totalKeys.length > 0) {
    const totalRowNumber = 6 + rows.length;
    const totalRow = sheet.getRow(totalRowNumber);
    totalRow.getCell(1).value = "Total";
    totalRow.getCell(1).font = { bold: true };
    for (const key of totalKeys) {
      const index = columns.findIndex((column) => column.key === key);
      if (index < 0) continue;
      const cell = totalRow.getCell(index + 1);
      const letter = sheet.getColumn(index + 1).letter;
      cell.value = { formula: `SUM(${letter}6:${letter}${5 + rows.length})` };
      cell.numFmt = `"${report.currency}" #,##0.00;[Red]-"${report.currency}" #,##0.00`;
      cell.font = { bold: true };
    }
    for (let column = 1; column <= columns.length; column += 1) {
      totalRow.getCell(column).fill = { type: "pattern", pattern: "solid", fgColor: { argb: SOFT_FILL } };
    }
  }

  sheet.autoFilter = {
    from: { row: 5, column: 1 },
    to: { row: Math.max(5, 5 + rows.length), column: columns.length },
  };
  sheet.pageSetup = { orientation: columns.length > 8 ? "landscape" : "portrait", fitToPage: true, fitToWidth: 1 };
  return sheet;
}

export async function buildFinancialReportWorkbook(report: FinancialReport): Promise<ArrayBuffer> {
  const { Workbook } = await import("exceljs");
  const workbook = new Workbook();
  workbook.creator = "Qai";
  workbook.created = new Date(report.generatedAt);
  workbook.modified = new Date(report.generatedAt);
  workbook.calcProperties.fullCalcOnLoad = true;

  addDataSheet(workbook, report, "Summary", [
    { header: "Metric", key: "metric", width: 32 },
    { header: `Amount (${report.currency})`, key: "value", width: 22, kind: "currency" },
    { header: "Count", key: "count", width: 14, kind: "number" },
  ], [
    { metric: "Income", value: report.summary.moneyReceived },
    { metric: "Expenses", value: report.summary.expenses },
    { metric: "Profit", value: report.summary.realizedProfit },
    { metric: "Expected Booking Value", value: report.summary.expectedBookingValue },
    { metric: "Estimated Job Profit", value: report.summary.estimatedJobProfit },
    { metric: "Unpaid Amount", value: report.summary.outstanding },
    { metric: "Bookings", count: report.summary.bookings },
    { metric: "Schedules", count: report.summary.scheduledSessions },
  ]);

  addDataSheet(workbook, report, "Income", [
    { header: "Date", key: "date", width: 14, kind: "date" },
    { header: "Client", key: "customer", width: 24 },
    { header: "Service", key: "service", width: 26 },
    { header: "Booking Status", key: "bookingStatus", width: 16 },
    { header: "Payment Method", key: "method", width: 18 },
    { header: "Amount", key: "amount", width: 20, kind: "currency" },
    { header: "Notes", key: "notes", width: 32 },
  ], report.moneyReceived, ["amount"]);

  addDataSheet(workbook, report, "Expenses", [
    { header: "Date", key: "date", width: 14, kind: "date" },
    { header: "Category", key: "category", width: 22 },
    { header: "Type", key: "type", width: 20 },
    { header: "Client", key: "customer", width: 24 },
    { header: "Service", key: "service", width: 24 },
    { header: "Paid To", key: "vendor", width: 22 },
    { header: "Payment Method", key: "paymentMethod", width: 18 },
    { header: "Amount", key: "amount", width: 20, kind: "currency" },
    { header: "Notes", key: "notes", width: 32 },
  ], report.expenses, ["amount"]);

  const bookingColumns: SheetColumn[] = [
    { header: "First Schedule", key: "firstSessionDate", width: 14, kind: "date" },
    { header: "Client", key: "customer", width: 24 },
    { header: "Service", key: "service", width: 26 },
    { header: "Status", key: "status", width: 14 },
    { header: "Schedules", key: "sessionCount", width: 12, kind: "number" },
    { header: "Booking Value", key: "bookingValue", width: 20, kind: "currency" },
    { header: "Paid", key: "totalPaid", width: 20, kind: "currency" },
    { header: "Unpaid Amount", key: "outstanding", width: 20, kind: "currency" },
    { header: "Direct Expenses", key: "directExpenses", width: 20, kind: "currency" },
    { header: "Est. Job Profit", key: "estimatedJobProfit", width: 20, kind: "currency" },
    { header: "Payment Due", key: "paymentDueDate", width: 14, kind: "date" },
    { header: "Notes", key: "notes", width: 32 },
  ];
  addDataSheet(workbook, report, "Job Profit", bookingColumns, report.jobProfit, ["bookingValue", "directExpenses", "estimatedJobProfit"]);
  addDataSheet(workbook, report, "Outstanding", bookingColumns, report.outstanding, ["bookingValue", "totalPaid", "outstanding"]);
  addDataSheet(workbook, report, "Bookings", bookingColumns, report.bookings, ["bookingValue", "totalPaid", "directExpenses"]);

  addDataSheet(workbook, report, "Schedule", [
    { header: "Date", key: "date", width: 14, kind: "date" },
    { header: "Start Time", key: "startAt", width: 14, kind: "time" },
    { header: "End Time", key: "endAt", width: 14, kind: "time" },
    { header: "Client", key: "customer", width: 24 },
    { header: "Service", key: "service", width: 26 },
    { header: "Location", key: "location", width: 28 },
    { header: "Booking Status", key: "bookingStatus", width: 16 },
    { header: "Schedule", key: "sessionContext", width: 24 },
    { header: "Notes", key: "notes", width: 32 },
  ], report.schedule);

  addDataSheet(workbook, report, "Invoices", [
    { header: "Invoice Date", key: "invoiceDate", width: 14, kind: "date" },
    { header: "Invoice Number", key: "invoiceNumber", width: 22 },
    { header: "Version", key: "version", width: 10, kind: "number" },
    { header: "Status", key: "lifecycle", width: 16 },
    { header: "Client", key: "client", width: 24 },
    { header: "Service", key: "service", width: 26 },
    { header: "Due Date", key: "dueDate", width: 14, kind: "date" },
    { header: "Style", key: "style", width: 16 },
    { header: "Subtotal", key: "subtotal", width: 18, kind: "currency" },
    { header: "Discount", key: "discount", width: 18, kind: "currency" },
    { header: "Tax", key: "tax", width: 18, kind: "currency" },
    { header: "Invoice Total", key: "total", width: 18, kind: "currency" },
    { header: "Recorded Payments", key: "paid", width: 20, kind: "currency" },
    { header: "Remaining", key: "remaining", width: 18, kind: "currency" },
  ], report.invoices, ["subtotal", "discount", "tax", "total", "paid", "remaining"]);

  const buffer = await workbook.xlsx.writeBuffer();
  const bytes = new Uint8Array(buffer.byteLength);
  bytes.set(new Uint8Array(buffer));
  return bytes.buffer;
}

export async function downloadFinancialReport(report: FinancialReport): Promise<void> {
  const bytes = await buildFinancialReportWorkbook(report);
  const blob = new Blob([bytes], { type: XLSX_MIME });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `Qai Financial Report — ${reportFilePeriodLabel(report)}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export { XLSX_MIME };
