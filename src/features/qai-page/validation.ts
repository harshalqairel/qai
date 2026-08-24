import { z } from "zod";
import {
  bookingQuestionnaireDefinitionSchema,
  bookingQuestionResponseSchema,
  DEFAULT_BOOKING_QUESTIONNAIRE,
} from "@/features/booking-questionnaire/questionnaire";
import type { BookingFormValues } from "@/features/booking/types";
import type { Service, ServiceSelectionSnapshot, ServiceVariant } from "@/features/service/types";
import { normalizeSocialProfile } from "@/features/qai-page/socialProfiles";

export type PublicPriceMode = "Fixed price" | "Starting from" | "Ask for price";
export type PublicActionMode = "Booking request" | "Inquiry" | "Instant booking";
export type PublicRequestStatus = "Pending" | "Accepted" | "Declined";
export const QAI_PAGE_TEMPLATES = ["Muse", "Studio", "Signature", "Professional", "Warm", "Editorial"] as const;
export const QAI_PAGE_TYPOGRAPHY = [
  "Elegant Serif + Clean Sans",
  "Editorial Serif + Sans",
  "Modern Sans",
  "Minimal Sans",
  "Contemporary Serif + Sans",
] as const;
const QAI_PAGE_TYPOGRAPHY_WITH_LEGACY = [...QAI_PAGE_TYPOGRAPHY, "Modern", "Editorial", "Classic"] as const;
export const QAI_PAGE_DENSITIES = ["Spacious", "Compact"] as const;
export const QAI_PAGE_TONES = ["Template default", "Light", "Dark"] as const;
export const QAI_PAGE_BUTTON_STYLES = ["Soft rounded", "Rounded", "Editorial"] as const;
export const QAI_PAGE_THEME_PRESETS = {
  Porcelain: { backgroundColor: "#F7F4F1", surfaceColor: "#FFFEFC", textColor: "#101828", mutedTextColor: "#667085", accentColor: "#8A4B67", buttonBackgroundColor: "#56334F", buttonTextColor: "#FFFFFF", borderColor: "#DED7D2" },
  Noir: { backgroundColor: "#090D12", surfaceColor: "#121821", textColor: "#F8FAFC", mutedTextColor: "#B6C0CE", accentColor: "#C48AA8", buttonBackgroundColor: "#8A4B67", buttonTextColor: "#FFFFFF", borderColor: "#2A3543" },
  Sage: { backgroundColor: "#F2F4EF", surfaceColor: "#FBFCF9", textColor: "#1E2923", mutedTextColor: "#657169", accentColor: "#657C69", buttonBackgroundColor: "#405848", buttonTextColor: "#FFFFFF", borderColor: "#D6DDD5" },
  Sand: { backgroundColor: "#F5F1EA", surfaceColor: "#FFFCF7", textColor: "#241C18", mutedTextColor: "#70635C", accentColor: "#A55D43", buttonBackgroundColor: "#603E32", buttonTextColor: "#FFFFFF", borderColor: "#DED2C7" },
  Cobalt: { backgroundColor: "#F5F7FB", surfaceColor: "#FFFFFF", textColor: "#0F1B33", mutedTextColor: "#61708A", accentColor: "#4F6BFF", buttonBackgroundColor: "#233B74", buttonTextColor: "#FFFFFF", borderColor: "#D9E0EB" },
  Mist: { backgroundColor: "#F0F3F5", surfaceColor: "#FAFCFD", textColor: "#17242E", mutedTextColor: "#61707B", accentColor: "#577482", buttonBackgroundColor: "#314C59", buttonTextColor: "#FFFFFF", borderColor: "#D4DDE2" },
} as const;
export const QAI_PAGE_SECTIONS = ["about", "portfolio", "services"] as const;
export const QAI_ATTRIBUTION_HREF = "/?ref=qai-page&utm_source=qai_page&utm_medium=attribution&utm_campaign=powered_by_qai";

export const DEFAULT_REJECTION_WHATSAPP_TEMPLATE = "Hi {client_name}, thank you for your interest in {service_name}. Unfortunately, we are unable to accept your booking request at this time. Thank you for your understanding.\n\n— {business_name}";

const defaultPageStyle = {
  accentColor: "#4F6BFF",
  backgroundColor: "#F7F8FC",
  surfaceColor: "#FFFFFF",
  textColor: "#111A31",
  mutedTextColor: "#667085",
  buttonBackgroundColor: "#56334F",
  buttonTextColor: "#FFFFFF",
  borderColor: "#D7DCE5",
  tone: "Template default" as const,
  typography: "Elegant Serif + Clean Sans" as const,
  buttonStyle: "Soft rounded" as const,
  density: "Spacious" as const,
  sectionOrder: ["portfolio", "services"] as Array<(typeof QAI_PAGE_SECTIONS)[number]>,
  showAbout: true,
  showPortfolio: true,
  showServices: true,
  showContact: true,
};

export const qaiPageStyleSchema = z.object({
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default(defaultPageStyle.accentColor),
  backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default(defaultPageStyle.backgroundColor),
  surfaceColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default(defaultPageStyle.surfaceColor),
  textColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default(defaultPageStyle.textColor),
  mutedTextColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default(defaultPageStyle.mutedTextColor),
  buttonBackgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default(defaultPageStyle.buttonBackgroundColor),
  buttonTextColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default(defaultPageStyle.buttonTextColor),
  borderColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default(defaultPageStyle.borderColor),
  tone: z.enum(QAI_PAGE_TONES).default(defaultPageStyle.tone),
  typography: z.enum(QAI_PAGE_TYPOGRAPHY_WITH_LEGACY).default(defaultPageStyle.typography),
  buttonStyle: z.enum(QAI_PAGE_BUTTON_STYLES).default(defaultPageStyle.buttonStyle),
  density: z.enum(QAI_PAGE_DENSITIES).default(defaultPageStyle.density),
  sectionOrder: z.array(z.enum(QAI_PAGE_SECTIONS)).min(1).max(QAI_PAGE_SECTIONS.length).default(defaultPageStyle.sectionOrder),
  showAbout: z.boolean().default(true),
  showPortfolio: z.boolean().default(true),
  showServices: z.boolean().default(true),
  showContact: z.boolean().default(true),
}).default(defaultPageStyle);

export const publicScheduleSchema = z.object({
  id: z.string().min(1).max(100),
  label: z.string().trim().max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  location: z.string().trim().max(300),
});

export const publicServiceSchema = z.object({
  serviceId: z.string().min(1).max(100),
  visible: z.boolean(),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000),
  price: z.number().finite().nonnegative().max(1_000_000_000_000),
  priceMode: z.enum(["Fixed price", "Starting from", "Ask for price"]),
  actionMode: z.enum(["Booking request", "Inquiry", "Instant booking"]),
  durationMinutes: z.number().int().positive().max(1440),
  defaultSessionCount: z.number().int().min(1).max(12).default(1),
  locationPolicy: z.enum(["Business/studio only", "Client location only", "Client can choose", "Online"]).default("Client can choose"),
  optionGroups: z.array(z.object({
    id: z.string().min(1).max(100),
    name: z.string().trim().min(1).max(80),
    position: z.number().int().min(0).max(1000),
    values: z.array(z.object({ id: z.string().min(1).max(100), label: z.string().trim().min(1).max(80), active: z.boolean(), position: z.number().int().min(0).max(1000) })).min(1).max(12),
  })).max(4).default([]),
  variants: z.array(z.object({
    id: z.string().min(1).max(100),
    optionValueIds: z.array(z.string().min(1).max(100)).min(1).max(4),
    displayLabel: z.string().trim().max(120),
    price: z.number().finite().nonnegative(),
    duration: z.number().finite().positive(),
    defaultSessionCount: z.number().int().min(1).max(50),
    active: z.boolean(),
  })).max(200).default([]),
  position: z.number().int().min(0).max(1000).default(0),
  featured: z.boolean().default(false),
});

export const instantSlotSchema = z.object({
  id: z.string().min(1).max(100), serviceId: z.string().min(1).max(100), startAt: z.string().datetime(), endAt: z.string().datetime(),
  location: z.string().trim().max(300), status: z.enum(["Available", "Reserved"]), requestId: z.string().nullable(),
});

export const portfolioItemSchema = z.object({
  id: z.string().min(1).max(100), imageUrl: z.string().min(1).max(500), caption: z.string().trim().max(240),
  serviceId: z.string().max(100).nullable(), visible: z.boolean(), position: z.number().int().min(0).max(100),
  workId: z.string().min(1).max(100).optional(),
  workTitle: z.string().trim().max(160).optional(),
  workDescription: z.string().trim().max(1000).optional(),
  workCategory: z.string().trim().max(100).optional(),
  isCover: z.boolean().optional(),
});

const socialProfileSchema = (platform: "instagram" | "tiktok") => z.string().trim().max(200)
  .refine((value) => normalizeSocialProfile(platform, value) !== null, { message: platform === "tiktok" ? "Enter a TikTok username or profile link." : "Enter an Instagram username or profile link." })
  .transform((value) => normalizeSocialProfile(platform, value) ?? "")
  .default("");

export const qaiPageSchema = z.object({
  id: z.string().min(1).max(100), businessId: z.string().min(1).max(100), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  template: z.enum(QAI_PAGE_TEMPLATES).default("Muse"), style: qaiPageStyleSchema,
  businessName: z.string().trim().min(1).max(160), shortDescription: z.string().trim().max(500), location: z.string().trim().max(200),
  whatsapp: z.string().trim().max(50), email: z.string().trim().email().or(z.literal("")), instagram: socialProfileSchema("instagram"), tiktok: socialProfileSchema("tiktok"),
  logo: z.string().max(3_000_000), coverImage: z.string().max(3_000_000), portfolio: z.array(portfolioItemSchema).max(40).default([]), services: z.array(publicServiceSchema).max(100), slots: z.array(instantSlotSchema).max(500),
  timezone: z.string().trim().min(1).max(100).default("Asia/Jakarta"),
  questionnaire: bookingQuestionnaireDefinitionSchema.default(DEFAULT_BOOKING_QUESTIONNAIRE),
  messages: z.object({ rejectionWhatsappTemplate: z.string().trim().max(4000).default(DEFAULT_REJECTION_WHATSAPP_TEMPLATE) }).default({ rejectionWhatsappTemplate: DEFAULT_REJECTION_WHATSAPP_TEMPLATE }),
  updatedAt: z.number().int().nonnegative(),
});

const serviceSelectionSnapshotSchema = z.object({
  serviceName: z.string().trim().min(1).max(160),
  variantId: z.string().min(1).max(100).nullable(),
  variantLabel: z.string().trim().max(200),
  options: z.array(z.object({ groupId: z.string().min(1).max(100), groupName: z.string().trim().min(1).max(80), valueId: z.string().min(1).max(100), valueLabel: z.string().trim().min(1).max(80) })).max(4),
  price: z.number().finite().nonnegative(),
  duration: z.number().finite().positive(),
  defaultSessionCount: z.number().int().min(1).max(50),
});

export const publicRequestSchema = z.object({
  id: z.string().min(1).max(100), pageId: z.string().min(1).max(100), slug: z.string().min(1).max(120), serviceId: z.string().min(1).max(100),
  serviceName: z.string().trim().min(1).max(160), type: z.enum(["Booking request", "Inquiry", "Instant booking"]),
  clientName: z.string().trim().min(1).max(160), whatsapp: z.string().trim().min(6).max(50), email: z.string().trim().email().or(z.literal("")), instagram: z.string().trim().max(200).default(""),
  submissionId: z.string().min(1).max(100).default(() => crypto.randomUUID()),
  clientId: z.string().min(1).max(100).nullable().default(null),
  serviceVariantId: z.string().min(1).max(100).nullable().default(null),
  serviceSnapshot: serviceSelectionSnapshotSchema.nullable().default(null),
  need: z.string().trim().max(1000), schedules: z.array(publicScheduleSchema).max(12), location: z.string().trim().max(300), budget: z.string().trim().max(100),
  questionnaireResponses: z.array(bookingQuestionResponseSchema).max(50).default([]),
  notes: z.string().trim().max(2000), status: z.enum(["Pending", "Accepted", "Declined"]), submittedAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(), bookingId: z.string().nullable(), instantSlotId: z.string().nullable(),
});

export type PublicSchedule = z.infer<typeof publicScheduleSchema>;
export type PublicService = z.infer<typeof publicServiceSchema>;
export type InstantSlot = z.infer<typeof instantSlotSchema>;
export type PortfolioItem = z.infer<typeof portfolioItemSchema>;
export type PortfolioWork = {
  id: string;
  title: string;
  description: string;
  category: string;
  serviceId: string | null;
  images: PortfolioItem[];
};
export type QaiPageConfig = z.infer<typeof qaiPageSchema>;
export type PublicRequest = z.infer<typeof publicRequestSchema>;

export type PublicServiceVariant = ServiceVariant;

export type ValidationStore = { pages: QaiPageConfig[]; requests: PublicRequest[] };

export function normalizeSlug(value: string): string {
  return value.normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

export function normalizeContactPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits;
}

function hexChannel(value: string): number { return Number.parseInt(value, 16) / 255; }
function relativeLuminance(color: string): number {
  const channels = [color.slice(1, 3), color.slice(3, 5), color.slice(5, 7)].map(hexChannel).map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
export function colorContrast(left: string, right: string): number {
  const values = [relativeLuminance(left), relativeLuminance(right)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
export function qaiPageThemeIssues(style: QaiPageConfig["style"]): string[] {
  const issues: string[] = [];
  if (colorContrast(style.textColor, style.backgroundColor) < 4.5) issues.push("Primary text needs more contrast against the page background.");
  if (colorContrast(style.mutedTextColor, style.backgroundColor) < 3) issues.push("Muted text needs more contrast against the page background.");
  if (colorContrast(style.buttonTextColor, style.buttonBackgroundColor) < 4.5) issues.push("Button text needs more contrast against the button color.");
  return issues;
}

export function normalizedPageSectionOrder(style: QaiPageConfig["style"]): Array<(typeof QAI_PAGE_SECTIONS)[number]> {
  const ordered = style.sectionOrder.filter((section, index, items) => items.indexOf(section) === index);
  return [...ordered, ...QAI_PAGE_SECTIONS.filter((section) => !ordered.includes(section))];
}

export function groupPortfolioWorks(items: readonly PortfolioItem[]): PortfolioWork[] {
  const groups = new Map<string, PortfolioWork>();
  [...items].sort((left, right) => left.position - right.position).forEach((item, index) => {
    const id = item.workId ?? item.id;
    const existing = groups.get(id);
    if (existing) {
      existing.images.push(item);
      if (!existing.serviceId && item.serviceId) existing.serviceId = item.serviceId;
      return;
    }
    groups.set(id, {
      id,
      title: item.workTitle?.trim() || item.caption.trim() || `Selected work ${index + 1}`,
      description: item.workDescription?.trim() || "",
      category: item.workCategory?.trim() || "",
      serviceId: item.serviceId,
      images: [item],
    });
  });
  return [...groups.values()].map((work) => ({
    ...work,
    images: [...work.images].sort((left, right) => Number(right.isCover) - Number(left.isCover) || left.position - right.position),
  }));
}

export function publicVariantForId(service: PublicService, variantId: string | null): PublicServiceVariant | null {
  if (!variantId) return null;
  return service.variants.find((variant) => variant.id === variantId && variant.active) ?? null;
}

export function snapshotPublicServiceSelection(service: PublicService, variantId: string | null): ServiceSelectionSnapshot {
  const variant = publicVariantForId(service, variantId);
  const options = variant ? [...service.optionGroups].sort((a, b) => a.position - b.position).flatMap((group) => {
    const value = group.values.find((candidate) => variant.optionValueIds.includes(candidate.id));
    return value ? [{ groupId: group.id, groupName: group.name, valueId: value.id, valueLabel: value.label }] : [];
  }) : [];
  return {
    serviceName: service.title,
    variantId: variant?.id ?? null,
    variantLabel: variant?.displayLabel || options.map((option) => option.valueLabel).join(" · "),
    options,
    price: variant?.price ?? service.price,
    duration: variant?.duration ?? service.durationMinutes,
    defaultSessionCount: variant?.defaultSessionCount ?? service.defaultSessionCount,
  };
}

export function publicPriceLabel(service: PublicService): string {
  if (service.priceMode === "Ask for price") return "Ask for price";
  const amount = `Rp ${Math.round(service.price).toLocaleString("id-ID")}`;
  return service.priceMode === "Starting from" ? `Starting from ${amount}` : amount;
}

export function publicActionLabel(mode: PublicActionMode): string {
  if (mode === "Instant booking") return "Book";
  if (mode === "Inquiry") return "Ask about this service";
  return "Request";
}

export function requiresClientServiceLocation(service: Pick<PublicService, "locationPolicy">, choice: "Business/studio" | "Client location"): boolean {
  return service.locationPolicy === "Client location only" || (service.locationPolicy === "Client can choose" && choice === "Client location");
}

export function resolvePublicServiceLocation(
  service: Pick<PublicService, "locationPolicy">,
  choice: "Business/studio" | "Client location",
  clientLocation: string,
  businessLocation: string,
): string {
  if (service.locationPolicy === "Online") return "Online";
  return requiresClientServiceLocation(service, choice) ? clientLocation.trim() : businessLocation.trim();
}

export function canShowBookedThroughQai(request: PublicRequest): boolean {
  return request.type === "Instant booking" && request.status === "Accepted";
}

export function requestToBookingValues(request: PublicRequest, service: Service, customerId: string, fallbackDate: string): BookingFormValues {
  const sourceSchedules = request.schedules.length ? request.schedules : [{ id: crypto.randomUUID(), label: "", date: fallbackDate, startTime: "09:00", endTime: "10:00", location: request.location }];
  const sessions = sourceSchedules.map((item) => ({ label: item.label, date: item.date, startTime: item.startTime, endTime: item.endTime, location: item.location || request.location, notes: request.need }));
  const finalDate = [...sessions].sort((left, right) => right.date.localeCompare(left.date))[0]?.date ?? fallbackDate;
  return {
    customerId, serviceId: service.id, sessions, servicePrice: request.serviceSnapshot?.price ?? service.price, serviceSnapshot: request.serviceSnapshot,
    bookingStatus: "Scheduled", fullPaymentDueDate: finalDate,
    questionnaireResponses: request.questionnaireResponses,
    notes: [request.need, request.notes, "Source: Qai Page"].filter(Boolean).join("\n\n"),
  };
}

export function derivePublicEndTime(startTime: string, durationMinutes: number): string {
  const [hour, minute] = startTime.split(":").map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return startTime;
  const total = (hour * 60 + minute + Math.max(1, durationMinutes)) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function defaultQaiPage(): QaiPageConfig {
  return {
    id: "local-page", businessId: "local-business", slug: "my-business", template: "Muse", style: structuredClone(defaultPageStyle), businessName: "My business", shortDescription: "", location: "",
    whatsapp: "", email: "", instagram: "", tiktok: "", logo: "", coverImage: "", portfolio: [], services: [], slots: [], timezone: "Asia/Jakarta", questionnaire: structuredClone(DEFAULT_BOOKING_QUESTIONNAIRE), messages: { rejectionWhatsappTemplate: DEFAULT_REJECTION_WHATSAPP_TEMPLATE }, updatedAt: Date.now(),
  };
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) }, cache: "no-store" });
  const data = await response.json() as { data?: T; error?: string };
  if (!response.ok) throw new Error(data.error ?? "Could not update validation data.");
  return data.data as T;
}

export const validationClient = {
  owner(): Promise<ValidationStore> { return api("/api/validation?scope=owner"); },
  page(slug: string): Promise<QaiPageConfig> { return api(`/api/validation?scope=page&slug=${encodeURIComponent(slug)}`); },
  savePage(page: QaiPageConfig): Promise<QaiPageConfig> { return api("/api/validation", { method: "POST", body: JSON.stringify({ action: "save-page", page }) }); },
  submitRequest(request: Omit<PublicRequest, "id" | "status" | "submittedAt" | "updatedAt" | "bookingId" | "clientId" | "serviceSnapshot">): Promise<PublicRequest> { return api("/api/validation", { method: "POST", body: JSON.stringify({ action: "submit-request", request }) }); },
  updateRequest(requestId: string, status: PublicRequestStatus, bookingId: string | null, clientId: string | null = null): Promise<PublicRequest> { return api("/api/validation", { method: "POST", body: JSON.stringify({ action: "update-request", requestId, status, bookingId, clientId }) }); },
  async uploadMedia(file: File, kind: "page-logo" | "page-cover" | "portfolio" | "invoice-logo" | "invoice-signature" | "invoice-stamp" | "invoice-watermark" | "booking-response"): Promise<{ id: string; url: string }> {
    const body = new FormData(); body.set("file", file); body.set("kind", kind);
    const response = await fetch("/api/validation/media", { method: "POST", body }); const result = await response.json() as { data?: { id: string; url: string }; error?: string };
    if (!response.ok || !result.data) throw new Error(result.error ?? "Could not upload that image."); return result.data;
  },
  async uploadPublicQuestionFile(file: File, slug: string, serviceId: string, questionId: string): Promise<{ id: string; url: string }> {
    const body = new FormData(); body.set("file", file); body.set("slug", slug); body.set("serviceId", serviceId); body.set("questionId", questionId);
    const response = await fetch("/api/validation/public-media", { method: "POST", body });
    const result = await response.json() as { data?: { id: string; url: string }; error?: string };
    if (!response.ok || !result.data) throw new Error(result.error ?? "Could not upload that file.");
    return result.data;
  },
  async deleteMedia(url: string): Promise<void> { const id = url.split("/").pop(); if (!id) return; await api(`/api/validation/media/${encodeURIComponent(id)}`, { method: "DELETE" }); },
};
