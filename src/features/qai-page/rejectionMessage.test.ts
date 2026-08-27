import { describe, expect, it } from "vitest";
import { rejectionWhatsAppUrl, renderRejectionMessage } from "./rejectionMessage";

describe("Qai Space rejection message", () => {
  it("renders only known placeholders and preserves unknown content", () => {
    expect(renderRejectionMessage("Hi {client_name}, {service_name} from {business_name}. {unknown}", { clientName: "Sarah", serviceName: "Wedding", businessName: "Nuyi" })).toBe("Hi Sarah, Wedding from Nuyi. {unknown}");
  });

  it("builds an encoded WhatsApp deep link and rejects invalid numbers", () => {
    expect(rejectionWhatsAppUrl("0812 3456 789", "Thank you & take care")).toContain("https://wa.me/628123456789?text=Thank%20you%20%26%20take%20care");
    expect(rejectionWhatsAppUrl("123", "Hello")).toBeNull();
  });
});
