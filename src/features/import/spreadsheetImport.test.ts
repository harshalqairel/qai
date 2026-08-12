import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bookingRepository } from "@/features/booking/api/bookingRepository";
import { BOOKING_STORAGE_KEY } from "@/features/booking/constants";
import { expenseRepository } from "@/features/expense/api/expenseRepository";
import { paymentRepository } from "@/features/payment/api/paymentRepository";
import { PAYMENT_STORAGE_KEY } from "@/features/payment/constants";
import { commitSpreadsheetImport, parseSpreadsheetFile, suggestMapping, type ImportSheet, type SpreadsheetPreview } from "./spreadsheetImport";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  failOnceForKey: string | null = null;
  private failed = false;
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { if (key === this.failOnceForKey && !this.failed) { this.failed = true; throw new DOMException("Quota exceeded", "QuotaExceededError"); } this.values.set(key, value); }
}

function sheet(name: string, domain: ImportSheet["domain"], headers: string[], mapping: Record<string, string>, rows: string[][]): ImportSheet {
  return { name, domain, headers, mapping, rows };
}

function preview(sourceHash = "source-a"): SpreadsheetPreview {
  return {
    fileName: "freelancer-business.xlsx",
    sourceHash,
    sheets: [
      sheet("Bookings", "bookings", ["Ref", "Client", "Phone", "Service", "Price", "Date", "Start", "End"], { Ref: "booking_id", Client: "client", Phone: "phone", Service: "service", Price: "price", Date: "date", Start: "start", End: "end" }, [["JOB-7", "Ayu", "0812", "Wedding Package", "Rp 7.500.000", "12/08/2026", "09:00", "11:00"]]),
      sheet("Schedules", "schedules", ["Ref", "Date", "Start", "End", "Label"], { Ref: "booking_id", Date: "date", Start: "start", End: "end", Label: "label" }, [["JOB-7", "12/08/2026", "09:00", "11:00", "Akad"], ["JOB-7", "15/08/2026", "18:00", "22:00", "Reception"], ["JOB-7", "20/08/2026", "23:00", "01:00", "After party"]]),
      sheet("Payments", "payments", ["Ref", "Tanggal Bayar", "Jumlah", "Metode"], { Ref: "booking_id", "Tanggal Bayar": "date", Jumlah: "amount", Metode: "method" }, [["JOB-7", "10/08/2026", "2.000.000", "transfer bank"]]),
      sheet("Expenses", "expenses", ["Tanggal", "Kategori", "Jumlah", "Jenis", "Vendor"], { Tanggal: "date", Kategori: "category", Jumlah: "amount", Jenis: "type", Vendor: "vendor" }, [["11/08/2026", "Transport", "250.000", "business", "Taxi"]]),
    ],
  };
}

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal("window", { localStorage: storage, dispatchEvent: () => true });
  vi.stubGlobal("CustomEvent", class { constructor(public type: string) {} });
});

afterEach(() => { vi.unstubAllGlobals(); });

describe("spreadsheet import", () => {
  it("parses CSV and suggests common Indonesian and English columns deterministically", async () => {
    const csv = new TextEncoder().encode("Booking ID,Client,Layanan,Harga,Tanggal\nJOB-1,Ayu,Makeup,7500000,12/08/2026\n");
    const file = { name: "bookings.csv", type: "text/csv", size: csv.byteLength, arrayBuffer: async () => csv.buffer.slice(csv.byteOffset, csv.byteOffset + csv.byteLength) } as File;
    const parsed = await parseSpreadsheetFile(file);
    expect(parsed.sheets[0].domain).toBe("bookings");
    expect(parsed.sheets[0].mapping).toMatchObject({ "Booking ID": "booking_id", Client: "client", Layanan: "service", Harga: "price", Tanggal: "date" });
    expect(suggestMapping("payments", ["Kode Booking", "Tanggal Bayar", "Jumlah", "Metode"])).toEqual({ "Kode Booking": "booking_id", "Tanggal Bayar": "date", Jumlah: "amount", Metode: "method" });
  });

  it("parses a genuine multi-sheet XLSX workbook", async () => {
    const { Workbook } = await import("exceljs");
    const workbook = new Workbook();
    workbook.addWorksheet("Bookings").addRows([
      ["Booking ID", "Client", "Layanan", "Harga", "Tanggal"],
      ["JOB-2", "Dina", "Kelas Makeup", 1_500_000, "18/08/2026"],
    ]);
    workbook.addWorksheet("Jadwal").addRows([
      ["Kode Booking", "Tanggal", "Jam Mulai", "Jam Selesai"],
      ["JOB-2", "18/08/2026", "09:00", "11:00"],
      ["JOB-2", "21/08/2026", "13:00", "15:00"],
    ]);
    const workbookBytes = new Uint8Array(await workbook.xlsx.writeBuffer());
    const arrayBuffer = workbookBytes.buffer.slice(workbookBytes.byteOffset, workbookBytes.byteOffset + workbookBytes.byteLength) as ArrayBuffer;
    const file = { name: "business.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: workbookBytes.byteLength, arrayBuffer: async () => arrayBuffer } as File;

    const parsed = await parseSpreadsheetFile(file);

    expect(parsed.sheets).toHaveLength(2);
    expect(parsed.sheets.map((item) => item.domain)).toEqual(["bookings", "schedules"]);
    expect(parsed.sheets[0].mapping).toMatchObject({ Client: "client", Layanan: "service", Harga: "price", Tanggal: "date" });
    expect(parsed.sheets[1].rows).toHaveLength(2);
  }, 15_000);

  it("commits one booking with deduplicated multi-schedules, actual payment, expense, and overnight timing", () => {
    const result = commitSpreadsheetImport(preview(), "Asia/Jakarta");
    expect(result).toMatchObject({ status: "completed", counts: { bookings: 1, schedules: 3, payments: 1, expenses: 1 } });
    const booking = bookingRepository.getAll()[0];
    expect(booking.sessions).toHaveLength(3);
    expect(Date.parse(booking.sessions[2].endAt)).toBeGreaterThan(Date.parse(booking.sessions[2].startAt));
    expect(paymentRepository.getAll()).toMatchObject([{ bookingId: booking.id, amount: 2_000_000 }]);
    expect(expenseRepository.getAll()).toMatchObject([{ expenseType: "Business Expense", bookingId: null, amount: 250_000 }]);
    expect(commitSpreadsheetImport(preview(), "Asia/Jakarta").status).toBe("already_imported");
  });

  it("rolls back every collection if an import write fails", () => {
    storage.failOnceForKey = PAYMENT_STORAGE_KEY;
    expect(() => commitSpreadsheetImport(preview("source-failure"), "Asia/Jakarta")).toThrow();
    expect(storage.getItem(BOOKING_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(PAYMENT_STORAGE_KEY)).toBeNull();
  });
});
