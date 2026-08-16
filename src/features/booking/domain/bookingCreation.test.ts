import { afterEach, describe, expect, it } from "vitest";
import type { CreateBookingCommand } from "@/features/booking/types";
import { bookingCreationRepository } from "@/features/booking/api/bookingCreationRepository";
import { bookingRepository } from "@/features/booking/api/bookingRepository";
import {
  BOOKING_CREATION_RECEIPT_STORAGE_KEY,
  BOOKING_STORAGE_KEY,
} from "@/features/booking/constants";
import { paymentRepository } from "@/features/payment/api/paymentRepository";
import { PAYMENT_STORAGE_KEY } from "@/features/payment/constants";
import { derivePaymentStatus } from "@/features/payment/utils/paymentCalculations";
import { buildFinancialReport } from "@/features/reports/financialReport";
import { prepareBookingCreation } from "./bookingCreation";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  failOnceForKey: string | null = null;
  private failed = false;

  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) {
    if (key === this.failOnceForKey && !this.failed) {
      this.failed = true;
      throw new DOMException("Storage quota exceeded", "QuotaExceededError");
    }
    this.values.set(key, value);
  }
}

function command(amount: number | null = 2_000_000): CreateBookingCommand {
  return {
    requestId: "request-1",
    booking: {
      customerId: "customer-1",
      serviceId: "service-1",
      sessions: [
        { id: undefined, label: "Akad", date: "2026-09-05", startTime: "09:00", endTime: "11:00", location: "Jakarta", notes: "" },
        { id: undefined, label: "Reception", date: "2026-09-08", startTime: "18:00", endTime: "22:00", location: "Bandung", notes: "" },
        { id: undefined, label: "Portraits", date: "2026-09-12", startTime: "08:00", endTime: "10:00", location: "Bogor", notes: "" },
      ],
      servicePrice: 7_500_000,
      bookingStatus: "Scheduled",
      fullPaymentDueDate: "2026-09-01",
      notes: "Wedding package",
    },
    initialPayment: amount === null ? null : {
      amount,
      method: "Bank Transfer",
      date: "2026-08-20",
      notes: "Deposit / DP",
    },
  };
}

function prepared(amount: number | null = 2_000_000) {
  return prepareBookingCreation(
    command(amount),
    "Asia/Jakarta",
    { bookingId: "booking-1", paymentId: amount === null ? null : "payment-1" },
    1_786_000_000_000,
  );
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
});

describe("booking creation with optional initial payment", () => {
  it("creates one multi-session booking and one normal booking-level payment", () => {
    const result = prepared();
    expect(result.booking.sessions).toHaveLength(3);
    expect(result.initialPayment).toMatchObject({
      id: "payment-1",
      bookingId: "booking-1",
      date: "2026-08-20",
      amount: 2_000_000,
    });
    expect(derivePaymentStatus("Scheduled", result.initialPayment!.amount, result.booking.servicePrice))
      .toBe("Partial Paid");
  });

  it("persists private questionnaire answer snapshots at booking level", () => {
    const base = command(null);
    const result = prepareBookingCreation({ ...base, booking: { ...base.booking, questionnaireResponses: [{ questionId: "look", labelSnapshot: "Desired look", typeSnapshot: "Short text", answer: "Natural glow" }] } }, "Asia/Jakarta", { bookingId: "booking-1", paymentId: null }, 1_786_000_000_000);
    expect(result.booking.questionnaireResponses).toEqual([{ questionId: "look", labelSnapshot: "Desired look", typeSnapshot: "Short text", answer: "Natural glow" }]);
  });

  it("derives unpaid, partial, and fully paid outcomes from real Payment records", () => {
    const unpaid = prepared(null);
    const partial = prepared(2_000_000);
    const paid = prepared(7_500_000);
    expect(unpaid.initialPayment).toBeNull();
    expect(derivePaymentStatus("Scheduled", 0, unpaid.booking.servicePrice)).toBe("Outstanding");
    expect(derivePaymentStatus("Scheduled", partial.initialPayment!.amount, partial.booking.servicePrice)).toBe("Partial Paid");
    expect(derivePaymentStatus("Scheduled", paid.initialPayment!.amount, paid.booking.servicePrice)).toBe("Fully Paid");
    expect(derivePaymentStatus("Cancelled", partial.initialPayment!.amount, partial.booking.servicePrice)).toBe("Cancelled");
  });

  it("rejects negative, malformed, non-finite, excessive, and cancelled-booking payments", () => {
    expect(() => prepared(-1)).toThrow();
    expect(() => prepareBookingCreation(
      { ...command(), initialPayment: { ...command().initialPayment!, amount: "invalid" as unknown as number } },
      "Asia/Jakarta",
      { bookingId: "booking-1", paymentId: "payment-1" },
    )).toThrow();
    expect(() => prepared(Number.NaN)).toThrow();
    expect(() => prepared(7_500_001)).toThrow(/cannot exceed/i);
    expect(() => prepareBookingCreation(
      { ...command(), booking: { ...command().booking, bookingStatus: "Cancelled" } },
      "Asia/Jakarta",
      { bookingId: "booking-1", paymentId: "payment-1" },
    )).toThrow(/cancelled/i);
  });

  it("persists booking-level and schedule-level charges and validates payment against the client total", () => {
    const base = command(7_800_000);
    const charged = prepareBookingCreation({
      ...base,
      booking: {
        ...base.booking,
        sessions: base.booking.sessions.map((session, index) => ({ ...session, id: `draft-session-${index + 1}` })),
      },
      additionalCharges: [
        { sessionId: null, categoryId: "transport", categoryName: "Transportation", description: "Client location", amount: 200_000 },
        { sessionId: "draft-session-2", categoryId: "parking", categoryName: "Parking", description: "Reception venue", amount: 100_000 },
      ],
    }, "Asia/Jakarta", { bookingId: "booking-1", paymentId: "payment-1" }, 1_786_000_000_000);

    expect(charged.booking.additionalCharges).toEqual([
      expect.objectContaining({ bookingId: "booking-1", sessionId: null, categoryName: "Transportation", amount: 200_000 }),
      expect.objectContaining({ bookingId: "booking-1", sessionId: "draft-session-2", categoryName: "Parking", amount: 100_000 }),
    ]);
    expect(charged.initialPayment?.amount).toBe(7_800_000);
    expect(() => prepareBookingCreation({ ...base, additionalCharges: [{ sessionId: "missing", categoryId: "parking", categoryName: "Parking", description: "", amount: 100_000 }] }, "Asia/Jakarta", { bookingId: "booking-1", paymentId: "payment-1" })).toThrow(/schedule was not found/i);
  });

  it("uses Payment Date for Income while sessions remain in their own calendar month", () => {
    const result = prepared();
    const common = {
      businessName: "Qai Test",
      currency: "IDR",
      timezone: "Asia/Jakarta",
      bookings: [result.booking],
      customers: [{ id: "customer-1", name: "Bucan", phone: "", instagram: "", email: "", notes: "", createdAt: 1 }],
      services: [{ id: "service-1", name: "Intermediate", categoryId: "service-category-1", price: 7_500_000, duration: 120, defaultSessionCount: 3, description: "", active: true }],
      payments: [result.initialPayment!],
      expenses: [],
      expenseCategories: [],
      generatedAt: new Date("2026-09-10T08:00:00.000Z"),
    };
    const august = buildFinancialReport({ ...common, period: { preset: "specific-month", selectedMonth: "2026-08" } });
    const september = buildFinancialReport({ ...common, period: { preset: "specific-month", selectedMonth: "2026-09" } });
    expect(august.summary.moneyReceived).toBe(2_000_000);
    expect(august.schedule).toHaveLength(0);
    expect(september.summary.moneyReceived).toBe(0);
    expect(september.schedule).toHaveLength(3);
  });

  it("rolls back every local collection on failure and makes retries idempotent", () => {
    const storage = new MemoryStorage();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage: storage },
    });
    storage.failOnceForKey = PAYMENT_STORAGE_KEY;

    expect(() => bookingCreationRepository.create(prepared())).toThrow();
    expect(storage.getItem(BOOKING_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(PAYMENT_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(BOOKING_CREATION_RECEIPT_STORAGE_KEY)).toBeNull();

    storage.failOnceForKey = null;
    expect(bookingCreationRepository.create(prepared()).created).toBe(true);
    expect(bookingCreationRepository.create(prepared()).created).toBe(false);
    expect(bookingRepository.getAll()).toHaveLength(1);
    expect(bookingRepository.getAll()[0].sessions).toHaveLength(3);
    expect(paymentRepository.getAll()).toHaveLength(1);
  });
});
