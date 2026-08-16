import type { BookingAdditionalCharge, BookingAdditionalChargeInput, BookingSession } from "@/features/booking/types";

export function prepareBookingAdditionalCharges(
  bookingId: string,
  inputs: readonly BookingAdditionalChargeInput[],
  sessions: readonly BookingSession[],
  existing: readonly BookingAdditionalCharge[] = [],
  now = Date.now(),
): BookingAdditionalCharge[] {
  const sessionIds = new Set(sessions.map((session) => session.id));
  const existingById = new Map(existing.map((charge) => [charge.id, charge]));
  return inputs.map((input) => {
    if (!input.categoryId.trim() || !input.categoryName.trim()) throw new Error("Additional charge category is required.");
    if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("Additional charge amount must be greater than zero.");
    if (input.sessionId && !sessionIds.has(input.sessionId)) throw new Error("Additional charge schedule was not found.");
    const prior = input.id ? existingById.get(input.id) : undefined;
    return {
      id: prior?.id ?? (input.id?.trim() || crypto.randomUUID()),
      bookingId,
      sessionId: input.sessionId || null,
      categoryId: input.categoryId.trim(),
      categoryName: input.categoryName.trim(),
      description: input.description.trim(),
      amount: input.amount,
      createdAt: prior?.createdAt ?? now,
      updatedAt: now,
    };
  });
}
