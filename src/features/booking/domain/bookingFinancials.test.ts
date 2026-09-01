import { describe, expect, it } from "vitest";
import { bookingClientTotal, calculateBookingFinancials } from "./bookingFinancials";

const booking = { id: "booking-1", servicePrice: 7_500_000, bookingStatus: "Scheduled" as const, additionalCharges: [{ id: "charge-1", bookingId: "booking-1", sessionId: null, categoryId: "transport", categoryName: "Transportation", description: "", amount: 300_000, createdAt: 1, updatedAt: 1 }] };

describe("booking financial truth", () => {
  it("keeps the standard booking payment state consistent", () => {
    const standard = { id: "booking-standard", servicePrice: 1_500_000, bookingStatus: "Scheduled" as const, additionalCharges: [] };
    const payment = { id: "payment-1", bookingId: standard.id, amount: 500_000 } as never;
    expect(calculateBookingFinancials(standard, [payment], [])).toMatchObject({
      clientTotal: 1_500_000,
      totalPaid: 500_000,
      outstanding: 1_000_000,
    });
  });

  it("keeps client charges separate from business expenses", () => {
    expect(bookingClientTotal(booking)).toBe(7_800_000);
    expect(calculateBookingFinancials(booking, [], [{ id: "expense-1", bookingId: "booking-1", amount: 220_000 } as never])).toMatchObject({ additionalCharges: 300_000, clientTotal: 7_800_000, directExpenses: 220_000, estimatedJobProfit: 7_580_000 });
  });

  it("does not confuse a client transportation charge with its real expense", () => {
    const charged = { ...booking, servicePrice: 1_500_000, additionalCharges: [{ ...booking.additionalCharges[0], amount: 200_000 }] };
    expect(calculateBookingFinancials(charged, [], [{ id: "expense-2", bookingId: charged.id, amount: 120_000 } as never])).toMatchObject({
      clientTotal: 1_700_000,
      directExpenses: 120_000,
      estimatedJobProfit: 1_580_000,
    });
  });

  it("adds multiple client charges without creating Direct Expenses", () => {
    const charged = {
      ...booking,
      additionalCharges: [
        ...booking.additionalCharges,
        { ...booking.additionalCharges[0], id: "charge-2", amount: 125_000 },
      ],
    };
    expect(calculateBookingFinancials(charged, [], [])).toMatchObject({
      servicePrice: 7_500_000,
      additionalCharges: 425_000,
      clientTotal: 7_925_000,
      directExpenses: 0,
      estimatedJobProfit: 7_925_000,
    });
  });

  it("treats an initial or later Payment as paid money without reducing Client Total", () => {
    const initial = { id: "payment-initial", bookingId: booking.id, amount: 2_000_000 } as never;
    const later = { id: "payment-later", bookingId: booking.id, amount: 1_000_000 } as never;
    expect(calculateBookingFinancials(booking, [initial], [])).toMatchObject({
      clientTotal: 7_800_000,
      totalPaid: 2_000_000,
      outstanding: 5_800_000,
    });
    expect(calculateBookingFinancials(booking, [initial, later], [])).toMatchObject({
      clientTotal: 7_800_000,
      totalPaid: 3_000_000,
      outstanding: 4_800_000,
    });
  });

  it("accepts an exact outstanding total in the model and preserves a persisted zero price", () => {
    const exact = { id: "payment-exact", bookingId: booking.id, amount: 7_800_000 } as never;
    expect(calculateBookingFinancials(booking, [exact], [])).toMatchObject({ outstanding: 0 });
    expect(calculateBookingFinancials({ ...booking, servicePrice: 0, additionalCharges: [] }, [], [])).toMatchObject({
      servicePrice: 0,
      clientTotal: 0,
      outstanding: 0,
    });
  });
});
