import { describe, expect, it } from "vitest";
import { buildEmailDraftUrl, buildWhatsAppMessageUrl } from "./communicationTransport";

describe("communication transports", () => {
  it("builds a safe Indonesian WhatsApp draft URL", () => {
    const url = buildWhatsAppMessageUrl("0812 3456 7890", "Hi Ayu & team");
    expect(url).toBe("https://wa.me/6281234567890?text=Hi%20Ayu%20%26%20team");
  });

  it("builds an encoded mailto draft URL", () => {
    expect(buildEmailDraftUrl("ayu@example.com", "Payment reminder", "Hi Ayu\nThank you"))
      .toBe("mailto:ayu%40example.com?subject=Payment%20reminder&body=Hi%20Ayu%0AThank%20you");
  });

  it("refuses missing or malformed recipients and empty drafts", () => {
    expect(buildWhatsAppMessageUrl("123", "Hello")).toBeNull();
    expect(buildWhatsAppMessageUrl("081234567890", " ")).toBeNull();
    expect(buildEmailDraftUrl("not-an-email", "Subject", "Hello")).toBeNull();
    expect(buildEmailDraftUrl("ayu@example.com", "Subject", " ")).toBeNull();
  });
});
