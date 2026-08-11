import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addReminderHistory, getLatestReminder, getReminderHistory } from "./reminderRepository";
import { getReminderTemplates, saveReminderTemplates } from "./reminderTemplateRepository";
import { DEFAULT_REMINDER_TEMPLATES, LOCAL_BUSINESS_ID } from "./reminderTemplates";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

describe("business-scoped reminder persistence", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: memoryStorage(), dispatchEvent: () => true });
    vi.stubGlobal("CustomEvent", class { constructor(public type: string) {} });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("persists customized templates and can reset them to defaults", () => {
    const customized = structuredClone(DEFAULT_REMINDER_TEMPLATES);
    customized.dueSoon.whatsapp = "Hi {customer_name}, pay {remaining_amount}.";
    saveReminderTemplates(LOCAL_BUSINESS_ID, customized);
    expect(getReminderTemplates(LOCAL_BUSINESS_ID).dueSoon.whatsapp).toContain("pay {remaining_amount}");
    saveReminderTemplates(LOCAL_BUSINESS_ID, DEFAULT_REMINDER_TEMPLATES);
    expect(getReminderTemplates(LOCAL_BUSINESS_ID)).toEqual(DEFAULT_REMINDER_TEMPLATES);
    expect(getReminderTemplates("another-business")).toEqual(DEFAULT_REMINDER_TEMPLATES);
  });

  it("preserves every outstanding snapshot and returns newest first", () => {
    addReminderHistory({ id: "first", businessId: LOCAL_BUSINESS_ID, bookingId: "booking-1", customerId: "customer-1", remindedAt: "2026-08-08T07:10:00.000Z", method: "WhatsApp", reminderType: "due-soon", outstandingBalance: 2_000_000 });
    addReminderHistory({ id: "second", businessId: LOCAL_BUSINESS_ID, bookingId: "booking-1", customerId: "customer-1", remindedAt: "2026-08-11T03:22:00.000Z", method: "Email", reminderType: "overdue", outstandingBalance: 1_500_000 });
    const history = getReminderHistory(LOCAL_BUSINESS_ID, "booking-1");
    expect(history.map((record) => record.id)).toEqual(["second", "first"]);
    expect(history.map((record) => record.outstandingBalance)).toEqual([1_500_000, 2_000_000]);
    expect(getLatestReminder(LOCAL_BUSINESS_ID, "booking-1")?.method).toBe("Email");
    expect(getReminderHistory("another-business", "booking-1")).toEqual([]);
  });
});
