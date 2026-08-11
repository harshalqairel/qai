import { describe, expect, it } from "vitest";

import type { Invoice, InvoiceSettings, InvoiceShareContext } from "./invoice";
import {
  DEFAULT_INVOICE_SHARE_TEMPLATES,
  generateInvoicePdf,
  insertInvoiceTemplateVariable,
  invoiceEmailUrl,
  invoicePaidAmount,
  invoicePaymentStatus,
  invoiceRemainingAmount,
  invoiceShareContext,
  invoiceTotals,
  invoiceWhatsAppUrl,
  issueInvoice,
  normalizeIndonesianPhone,
  renderInvoiceShareTemplate,
  validateInvoiceShareTemplate,
} from "./invoice";

const settings: InvoiceSettings = {
  businessId: "business-1", businessLogo: "", businessName: "Nuyi Makeup Studio", legalName: "PT Nuyi", address: "Bandung", phone: "0812",
  email: "studio@example.com", invoicePrefix: "INV", paymentInstructions: "BCA 1234567890", defaultNotes: "Thank you.", defaultPaymentTerms: "7 days",
  showSchedules: true, showQaiAttribution: true,
};

function sampleInvoice(changes: Partial<Invoice> = {}): Invoice {
  return {
    id: "invoice-1", businessId: "business-1", bookingId: "booking-1", clientId: "client-1", lifecycle: "Draft", invoiceNumber: null,
    clientName: "Sarah Wijaya", clientPhone: "081234567890", clientEmail: "sarah@example.com", serviceName: "Wedding Package",
    invoiceDate: "2026-08-11", dueDate: "2026-08-18", lineItems: [
      { id: "item-1", item: "Wedding makeup", description: "Akad and reception", quantity: 1, unitPrice: 5_000_000 },
      { id: "item-2", item: "Assistant", description: "", quantity: 2, unitPrice: 350_000 },
    ], discount: 200_000, tax: 100_000, paymentInstructions: "BCA 1234567890", notes: "Long-form notes remain attached to the invoice.",
    schedules: [
      { label: "Akad", startAt: "2026-08-12T03:00:00.000Z", endAt: "2026-08-12T05:00:00.000Z", location: "Bandung" },
      { label: "Reception", startAt: "2026-08-15T10:00:00.000Z", endAt: "2026-08-15T13:00:00.000Z", location: "Bandung" },
    ], showSchedules: true, snapshot: null, createdAt: 1, updatedAt: 1, issuedAt: null, ...changes,
  };
}

describe("invoice financial rules", () => {
  it("calculates quantities, discount, tax, and payment status", () => {
    const invoice = sampleInvoice();
    expect(invoiceTotals(invoice)).toEqual({ subtotal: 5_700_000, total: 5_600_000 });
    expect(invoicePaymentStatus(5_600_000, 0)).toBe("Unpaid");
    expect(invoicePaymentStatus(5_600_000, 2_000_000)).toBe("Part paid");
    expect(invoicePaymentStatus(5_600_000, 5_600_000)).toBe("Paid");
  });

  it("uses only actual booking Payment records for paid and remaining amounts", () => {
    const invoice = sampleInvoice();
    const payments = [{ id: "p1", bookingId: "booking-1", amount: 2_000_000, date: "2026-08-11", method: "Bank Transfer" as const, notes: "", createdAt: 1 }];
    expect(invoicePaidAmount(invoice, payments)).toBe(2_000_000);
    expect(invoiceRemainingAmount(invoice, payments)).toBe(3_600_000);
    expect(invoicePaidAmount({ ...invoice, bookingId: null }, payments)).toBe(0);
  });
});

describe("invoice lifecycle", () => {
  it("assigns stable sequential numbers and preserves an issued snapshot", () => {
    const first = issueInvoice(sampleInvoice(), settings, [], Date.UTC(2026, 7, 11));
    expect(first.invoiceNumber).toBe("INV-2026-0001");
    const unchanged = issueInvoice(first, { ...settings, businessName: "Changed later" }, [first], Date.UTC(2026, 7, 12));
    expect(unchanged).toEqual(first);
    expect(unchanged.snapshot?.businessName).toBe("Nuyi Makeup Studio");
    expect(unchanged.snapshot?.schedules).toHaveLength(2);
    const second = issueInvoice(sampleInvoice({ id: "invoice-2" }), settings, [first], Date.UTC(2026, 7, 12));
    expect(second.invoiceNumber).toBe("INV-2026-0002");
  });
});

describe("invoice sharing", () => {
  const context: InvoiceShareContext = {
    clientName: "Sarah", businessName: "Nuyi", invoiceNumber: "INV-2026-0008", invoiceDate: "11 Aug 2026", dueDate: "18 Aug 2026",
    invoiceTotal: "Rp 7.500.000", amountPaid: "Rp 2.000.000", amountRemaining: "Rp 5.500.000", serviceName: "Wedding Package",
    bookingDate: "12 Aug 2026", nextSchedule: "15 Aug 2026", paymentInstructions: "BCA 123",
  };

  it("renders every supported variable without unresolved values or Qai advertising", () => {
    const all = "{client_name}|{business_name}|{invoice_number}|{invoice_date}|{due_date}|{invoice_total}|{amount_paid}|{amount_remaining}|{service_name}|{booking_date}|{next_schedule}|{payment_instructions}";
    const rendered = renderInvoiceShareTemplate(all, context);
    expect(rendered.errors).toEqual([]);
    expect(rendered.value).not.toMatch(/undefined|null|NaN|\{[^}]+\}/);
    expect(renderInvoiceShareTemplate(DEFAULT_INVOICE_SHARE_TEMPLATES.whatsapp, context).value).not.toContain("Qai");
  });

  it("inserts variables at the cursor and reports friendly template errors", () => {
    expect(insertInvoiceTemplateVariable("Hi ,", "{client_name}", 3)).toBe("Hi {client_name},");
    expect(validateInvoiceShareTemplate("Hi {booking_balance}")[0]).toBe("Unknown variable: booking balance");
    expect(validateInvoiceShareTemplate("Hi {client_name")[0]).toContain("opening and closing brace");
  });

  it("normalizes WhatsApp only for transport and encodes WhatsApp and email links", () => {
    expect(normalizeIndonesianPhone("0812-3456-7890")).toBe("6281234567890");
    expect(invoiceWhatsAppUrl("0812 3456", "Hi Sarah & family")).toContain("https://wa.me/628123456");
    expect(invoiceWhatsAppUrl("0812 3456", "Hi Sarah & family")).toContain("Hi%20Sarah%20%26%20family");
    expect(invoiceEmailUrl("sarah@example.com", "Invoice 1", "Thank you")).toBe("mailto:sarah%40example.com?subject=Invoice%201&body=Thank%20you");
  });

  it("builds share data from the issued snapshot while keeping linked payments dynamic", () => {
    const issued = issueInvoice(sampleInvoice(), settings, [], Date.UTC(2026, 7, 11));
    const result = invoiceShareContext(issued, { ...settings, businessName: "Changed" }, [{ id: "p1", bookingId: "booking-1", amount: 2_000_000, date: "2026-08-11", method: "Cash", notes: "", createdAt: 1 }]);
    expect(result.businessName).toBe("Nuyi Makeup Studio");
    expect(result.amountPaid).toBe("Rp 2.000.000");
    expect(result.nextSchedule).toMatch(/Aug 2026/);
  });
});

describe("invoice PDF", () => {
  it("creates a genuine PDF blob for a multipage-capable issued invoice", async () => {
    const items = Array.from({ length: 45 }, (_, index) => ({ id: `item-${index}`, item: `Professional service line ${index + 1}`, description: "A clear description that can wrap safely without clipping.", quantity: 1, unitPrice: 100_000 }));
    const issued = issueInvoice(sampleInvoice({ lineItems: items, notes: "Detailed notes ".repeat(80) }), settings, [], Date.UTC(2026, 7, 11));
    const blob = await generateInvoicePdf(issued, settings, [], "blob");
    expect(blob).toBeInstanceOf(Blob);
    const bytes = new Uint8Array(await blob!.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(5_000);
  }, 20_000);
});
