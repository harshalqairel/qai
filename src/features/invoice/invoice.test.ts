import { describe, expect, it } from "vitest";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import type { Invoice, InvoiceSettings, InvoiceShareContext, InvoiceStyle } from "./invoice";
import {
  DEFAULT_INVOICE_SHARE_TEMPLATES,
  DEFAULT_INVOICE_SETTINGS,
  generateInvoicePdf,
  createInvoiceRevision,
  insertInvoiceTemplateVariable,
  invoiceEmailUrl,
  invoicePaidAmount,
  invoicePaymentStatus,
  invoiceRemainingAmount,
  invoiceShareContext,
  invoiceTotals,
  invoiceWatermarkLayout,
  invoiceWhatsAppUrl,
  issueInvoice,
  latestReportableInvoiceVersions,
  normalizeIndonesianPhone,
  renderInvoiceShareTemplate,
  validateInvoiceShareTemplate,
} from "./invoice";

const settings: InvoiceSettings = {
  ...DEFAULT_INVOICE_SETTINGS,
  businessId: "business-1", businessLogo: "", businessName: "Nuyi Makeup Studio", legalName: "PT Nuyi", address: "Bandung", phone: "0812",
  email: "studio@example.com", invoicePrefix: "INV", paymentInstructions: "BCA 1234567890", defaultNotes: "Thank you.", defaultPaymentTerms: "7 days",
  showSchedules: true, showQaiAttribution: true,
};

function sampleInvoice(changes: Partial<Invoice> = {}): Invoice {
  return {
    id: "invoice-1", previousVersionId: null, version: 1, businessId: "business-1", bookingId: "booking-1", clientId: "client-1", lifecycle: "Draft", invoiceNumber: null,
    clientName: "Sarah Wijaya", clientPhone: "081234567890", clientEmail: "sarah@example.com", serviceName: "Wedding Package",
    invoiceDate: "2026-08-11", dueDate: "2026-08-18", lineItems: [
      { id: "item-1", item: "Wedding makeup", description: "Akad and reception", quantity: 1, unitPrice: 5_000_000 },
      { id: "item-2", item: "Assistant", description: "", quantity: 2, unitPrice: 350_000 },
    ], discount: 200_000, tax: 100_000, discountMode: "fixed", discountValue: 200_000, taxPercent: 0, invoiceStyle: "Neutral", paymentInstructions: "BCA 1234567890", notes: "Long-form notes remain attached to the invoice.",
    schedules: [
      { label: "Akad", startAt: "2026-08-12T03:00:00.000Z", endAt: "2026-08-12T05:00:00.000Z", location: "Bandung" },
      { label: "Reception", startAt: "2026-08-15T10:00:00.000Z", endAt: "2026-08-15T13:00:00.000Z", location: "Bandung" },
    ], showSchedules: true, snapshot: null, createdAt: 1, updatedAt: 1, issuedAt: null, ...changes, rootInvoiceId: changes.rootInvoiceId ?? "invoice-1",
  };
}

describe("invoice financial rules", () => {
  it("calculates quantities, discount, tax, and payment status", () => {
    const invoice = sampleInvoice();
    expect(invoiceTotals(invoice)).toEqual({ subtotal: 5_700_000, discount: 200_000, tax: 0, total: 5_500_000 });
    expect(invoicePaymentStatus(5_600_000, 0)).toBe("Unpaid");
    expect(invoicePaymentStatus(5_600_000, 2_000_000)).toBe("Part paid");
    expect(invoicePaymentStatus(5_600_000, 5_600_000)).toBe("Paid");
    expect(invoicePaymentStatus(5_600_000, 0, "2026-08-18", "2026-08-18")).toBe("Unpaid");
    expect(invoicePaymentStatus(5_600_000, 2_000_000, "2026-08-18", "2026-08-19")).toBe("Overdue");
    expect(invoicePaymentStatus(5_600_000, 5_600_000, "2026-08-18", "2026-08-19")).toBe("Paid");
  });

  it("uses only actual booking Payment records for paid and remaining amounts", () => {
    const invoice = sampleInvoice();
    const payments = [{ id: "p1", bookingId: "booking-1", amount: 2_000_000, date: "2026-08-11", method: "Bank Transfer" as const, notes: "", createdAt: 1 }];
    expect(invoicePaidAmount(invoice, payments)).toBe(2_000_000);
    expect(invoiceRemainingAmount(invoice, payments)).toBe(3_500_000);
    expect(invoicePaidAmount({ ...invoice, bookingId: null }, payments)).toBe(0);
  });
});

describe("invoice lifecycle", () => {
  it("keeps watermark state invoice-specific and clamps rendering controls", () => {
    const draft = sampleInvoice({ watermarkEnabled: true, watermarkImage: "data:image/png;base64,AA==", watermarkOpacity: 0.12, watermarkRotation: -35, watermarkScale: 0.8 });
    expect(invoiceWatermarkLayout({ ...draft, watermarkOpacity: 0.5, watermarkRotation: -90, watermarkScale: 1 })).toEqual({ enabled: true, image: draft.watermarkImage, opacity: 0.2, rotation: -45, scale: 0.9 });
    const issued = issueInvoice(draft, settings, [], Date.UTC(2026, 7, 11));
    expect(issued.snapshot).toMatchObject({ watermarkEnabled: true, watermarkImage: draft.watermarkImage, watermarkOpacity: 0.12, watermarkRotation: -35, watermarkScale: 0.8 });
    expect(invoiceWatermarkLayout(sampleInvoice())).toMatchObject({ enabled: false });
  });

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

  it("creates an immutable revision draft and applies percentage discount before tax", () => {
    const issued = issueInvoice(sampleInvoice({ discountMode: "percentage", discountValue: 10, taxPercent: 11 }), settings, [], Date.UTC(2026, 7, 11));
    expect(invoiceTotals(issued.snapshot!)).toEqual({ subtotal: 5_700_000, discount: 570_000, tax: 564_300, total: 5_694_300 });
    const revision = createInvoiceRevision(issued, 99);
    expect(revision).toMatchObject({ lifecycle: "Revision Draft", version: 2, rootInvoiceId: issued.id, previousVersionId: issued.id, snapshot: null });
    expect(issued.snapshot?.version).toBe(1);
  });

  it("supports named added and deducted percentage or fixed taxes", () => {
    const base = sampleInvoice({
      discountMode: "none",
      discountValue: 0,
      taxEnabled: true,
      taxName: "PPN",
      taxMode: "percentage",
      taxValue: 11,
      taxTreatment: "added",
    });
    expect(invoiceTotals(base)).toEqual({ subtotal: 5_700_000, discount: 0, tax: 627_000, total: 6_327_000 });
    expect(invoiceTotals({ ...base, taxName: "PPh", taxValue: 2, taxTreatment: "deducted" })).toEqual({ subtotal: 5_700_000, discount: 0, tax: 114_000, total: 5_586_000 });
    expect(invoiceTotals({ ...base, taxMode: "fixed", taxValue: 50_000 })).toEqual({ subtotal: 5_700_000, discount: 0, tax: 50_000, total: 5_750_000 });
  });

  it("calculates the validation discount and PPN example deterministically", () => {
    const result = invoiceTotals({
      lineItems: [{ id: "line", item: "Package", description: "", quantity: 1, unitPrice: 1_700_000 }],
      discount: 0,
      tax: 0,
      discountMode: "percentage",
      discountValue: 10,
      taxEnabled: true,
      taxName: "PPN",
      taxMode: "percentage",
      taxValue: 11,
      taxTreatment: "added",
    });
    expect(result).toEqual({ subtotal: 1_700_000, discount: 170_000, tax: 168_300, total: 1_698_300 });
  });

  it("keeps the latest issued version reportable while a newer revision is still a draft", () => {
    const issued = issueInvoice(sampleInvoice(), settings, [], Date.UTC(2026, 7, 11));
    const revisionDraft = createInvoiceRevision(issued, 99);
    expect(latestReportableInvoiceVersions([issued, revisionDraft])).toEqual([issued]);
    const reissued = issueInvoice(revisionDraft, settings, [issued, revisionDraft], 100);
    expect(latestReportableInvoiceVersions([issued, revisionDraft, reissued])).toEqual([reissued]);
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
  it("creates genuine multipage PDFs for every style and optional business-mark combination", async () => {
    const items = Array.from({ length: 45 }, (_, index) => ({ id: `item-${index}`, item: `Professional service line ${index + 1}`, description: "A clear description that can wrap safely without clipping.", quantity: 1, unitPrice: 100_000 }));
    const iconBytes = await readFile("public/icons/qai-icon-192.png");
    const businessMark = `data:image/png;base64,${iconBytes.toString("base64")}`;
    const variants: Array<{ style: InvoiceStyle; businessLogo: string; signatureImage: string; stampImage: string }> = [
      { style: "Creative", businessLogo: businessMark, signatureImage: businessMark, stampImage: "" },
      { style: "Neutral", businessLogo: "", signatureImage: "", stampImage: businessMark },
      { style: "Professional", businessLogo: businessMark, signatureImage: businessMark, stampImage: businessMark },
      { style: "Modern Classic", businessLogo: businessMark, signatureImage: businessMark, stampImage: businessMark },
    ];

    for (const variant of variants) {
      const variantSettings = { ...settings, ...variant, invoiceStyle: variant.style };
      const issued = issueInvoice(sampleInvoice({ lineItems: items, notes: "Detailed notes ".repeat(80), invoiceStyle: variant.style, watermarkEnabled: variant.style === "Professional", watermarkImage: variant.style === "Professional" ? businessMark : "", watermarkOpacity: 0.08, watermarkRotation: -35, watermarkScale: 0.72 }), variantSettings, [], Date.UTC(2026, 7, 11));
      const blob = await generateInvoicePdf(issued, variantSettings, [], "blob");
      expect(blob).toBeInstanceOf(Blob);
      const bytes = new Uint8Array(await blob!.arrayBuffer());
      expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
      expect(bytes.length).toBeGreaterThan(5_000);
      if (process.env.QAI_INVOICE_FIXTURE_DIR) {
        await mkdir(process.env.QAI_INVOICE_FIXTURE_DIR, { recursive: true });
        await writeFile(`${process.env.QAI_INVOICE_FIXTURE_DIR}/${variant.style.toLowerCase()}.pdf`, bytes);
        const shortIssued = issueInvoice(sampleInvoice({
          invoiceStyle: variant.style,
          taxEnabled: true,
          taxName: "PPN",
          taxMode: "percentage",
          taxValue: 11,
          taxTreatment: "added",
        }), variantSettings, [], Date.UTC(2026, 7, 11));
        const shortBlob = await generateInvoicePdf(shortIssued, variantSettings, [{
          id: "fixture-payment", bookingId: "booking-1", amount: 2_000_000, date: "2026-08-11",
          method: "Bank Transfer", notes: "Deposit", createdAt: Date.UTC(2026, 7, 11),
        }], "blob");
        const shortBytes = new Uint8Array(await shortBlob!.arrayBuffer());
        await writeFile(`${process.env.QAI_INVOICE_FIXTURE_DIR}/${variant.style.toLowerCase()}-short.pdf`, shortBytes);
      }
    }
  }, 20_000);
});
