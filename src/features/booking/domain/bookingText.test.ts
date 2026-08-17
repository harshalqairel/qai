import { describe, expect, it } from "vitest";
import type { Customer } from "@/features/customer/types";
import type { Service } from "@/features/service/types";
import { DEFAULT_BOOKING_QUESTIONNAIRE, type BookingQuestion } from "@/features/booking-questionnaire/questionnaire";
import { DEFAULT_BOOKING_TEMPLATE_PREFERENCES, formatBookingClientTemplate, matchExistingCustomer, matchExistingService, matchParsedServiceVariant, normalizeBookingPhone, parseBookingText } from "./bookingText";

const customers: Customer[] = [
  { id: "c1", name: "Thia", phone: "0812 7980 7538", instagram: "@thia", email: "", notes: "", createdAt: 1 },
  { id: "c2", name: "Maya", phone: "+62 811 1111", instagram: "https://instagram.com/maya.studio", email: "", notes: "", createdAt: 2 },
];
const services: Service[] = [
  { id: "s1", name: "Regular Makeup", categoryId: "cat", price: 1, duration: 60, defaultSessionCount: 1, description: "", active: true },
  { id: "s2", name: "Wedding Makeup", categoryId: "cat", price: 2, duration: 120, defaultSessionCount: 1, description: "", active: true },
];

describe("structured booking text", () => {
  const question: BookingQuestion = { id: "look", label: "Desired Look", helperText: "", type: "Single choice", required: true, options: ["Natural", "Glam"], active: true, order: 0, serviceIds: [], createdAt: 1, updatedAt: 1 };
  it("parses the standard Qai template without saving or inventing values", () => {
    const result = parseBookingText("Name: Thia\nPhone: 081279807538\nInstagram: @thia\nService: Regular Makeup\nDate: 7 February 2026\nStart time: 15:00\nLocation: Fave Hotel\nNotes: Bridesmaid makeup");
    expect(result).toMatchObject({ name: "Thia", phone: "081279807538", instagram: "@thia", service: "Regular Makeup", date: "2026-02-07", startTime: "15:00", location: "Fave Hotel", notes: "Bridesmaid makeup" });
    expect(result.warnings).toEqual([]);
  });

  it("accepts Indonesian labels, dates, phone formatting, capitalization, and whitespace", () => {
    const result = parseBookingText("  NAMA : Maya \n NOMOR WA: +62 811-1111\n IG: instagram.com/maya.studio/\n LAYANAN : Wedding Makeup\n TANGGAL: 12 Agustus 2026\n JAM MULAI : 9.30 am");
    expect(result).toMatchObject({ name: "Maya", date: "2026-08-12", startTime: "09:30", instagram: "@maya.studio" });
    expect(normalizeBookingPhone(result.phone)).toBe("628111111");
  });

  it("keeps blank optional values blank and marks malformed critical rows for review", () => {
    const result = parseBookingText("Name: Thia\nPhone: 0812\nInstagram:\nEmail:\nService:\nDate: tomorrow\nStart time: afternoon\nNotes:");
    expect(result.instagram).toBe("");
    expect(result.email).toBe("");
    expect(result.date).toBe("");
    expect(result.startTime).toBe("");
    expect(result.warnings.join(" ")).toMatch(/date|start time|service/i);
  });

  it("uses phone as the strongest client match and Instagram as a secondary signal", () => {
    expect(matchExistingCustomer({ phone: "+62 812-7980-7538", instagram: "@someone" }, customers)).toMatchObject({ kind: "exact", matches: [{ id: "c1" }] });
    expect(matchExistingCustomer({ phone: "", instagram: "https://instagram.com/maya.studio" }, customers)).toMatchObject({ kind: "exact", matches: [{ id: "c2" }] });
  });

  it("reports ambiguous clients instead of merging or creating a duplicate silently", () => {
    const duplicate = { ...customers[0], id: "c3", name: "Other Thia" };
    expect(matchExistingCustomer({ phone: "081279807538", instagram: "" }, [...customers, duplicate])).toMatchObject({ kind: "ambiguous" });
  });

  it("preselects only exact services and reports ambiguous exact matches", () => {
    expect(matchExistingService(" regular   makeup ", services)).toMatchObject({ kind: "exact", matches: [{ id: "s1" }] });
    expect(matchExistingService("Makeup", services).kind).toBe("none");
    expect(matchExistingService("Regular Makeup", [...services, { ...services[0], id: "s3" }]).kind).toBe("ambiguous");
  });

  it("maps pasted generic service options only to a configured valid variant", () => {
    const optionService: Service = { ...services[0], optionGroups: [{ id: "artist", name: "Artist", position: 0, values: [{ id: "owner", label: "Owner", active: true, position: 0 }] }], variants: [{ id: "owner-variant", optionValueIds: ["owner"], displayLabel: "Owner", price: 2, duration: 90, defaultSessionCount: 1, active: true }] };
    const parsed = parseBookingText("Service: Regular Makeup\nArtist: Owner", [], [optionService]);
    expect(matchParsedServiceVariant(parsed, optionService)).toMatchObject({ kind: "exact", matches: [{ id: "owner-variant" }] });
  });

  it("creates a customizable copyable template from supported fields", () => {
    const value = formatBookingClientTemplate("Nuyi Makeup", { ...DEFAULT_BOOKING_TEMPLATE_PREFERENCES, enabledFields: ["name", "phone", "service", "date"] });
    expect(value).toContain("Name:");
    expect(value).toContain("Service:");
    expect(value).not.toContain("Instagram:");
    expect(value).toContain("confirm the schedule");
  });

  it("directs file questions to the private Booking Page upload flow", () => {
    const fileQuestion: BookingQuestion = { ...question, id: "reference", label: "Reference photo", type: "File / image", options: [] };
    const definition = { ...DEFAULT_BOOKING_QUESTIONNAIRE, questions: [fileQuestion] };
    expect(formatBookingClientTemplate("Nuyi Makeup", definition)).toContain("Reference photo: Please upload this through our Booking Page.");
  });

  it("preserves the user's chosen template field order", () => {
    const value = formatBookingClientTemplate("Nuyi Makeup", { ...DEFAULT_BOOKING_TEMPLATE_PREFERENCES, enabledFields: ["service", "date", "name"] });
    expect(value.indexOf("Service:")).toBeLessThan(value.indexOf("Date:"));
    expect(value.indexOf("Date:")).toBeLessThan(value.indexOf("Name:"));
  });

  it("uses configured labels in both copied templates and strict case-insensitive paste parsing", () => {
    const definition = { ...DEFAULT_BOOKING_QUESTIONNAIRE, questions: [question] };
    expect(formatBookingClientTemplate("Nuyi Makeup", definition)).toContain("Desired Look:");
    const parsed = parseBookingText("Name: Sarah\nPhone: 081234567890\nService: Wedding Makeup\nDate: 12 Aug 2026\nStart time: 09:00\ndesired look: Glam", definition.questions);
    expect(parsed.customResponses).toEqual([{ questionId: "look", labelSnapshot: "Desired Look", typeSnapshot: "Single choice", answer: "Glam" }]);
  });

  it("never guesses malformed configured answers", () => {
    const parsed = parseBookingText("Desired Look: cinematic", [question]);
    expect(parsed.customResponses).toEqual([]);
    expect(parsed.warnings.join(" ")).toMatch(/desired look/i);
  });
});
