import type { Customer } from "@/features/customer/types";
import type { Service, ServiceVariant } from "@/features/service/types";
import {
  findClientMatches,
  normalizeClientInstagram,
  normalizeClientPhone,
} from "@/features/customer/domain/clientIdentity";
import {
  BOOKING_CORE_FIELDS,
  BOOKING_CORE_FIELD_LABELS,
  DEFAULT_BOOKING_QUESTIONNAIRE,
  normalizeQuestionLabel,
  questionsForService,
  responseForQuestion,
  type BookingQuestion,
  type BookingQuestionResponse,
  type BookingQuestionnaireDefinition,
} from "@/features/booking-questionnaire/questionnaire";

export const BOOKING_TEMPLATE_FIELDS = BOOKING_CORE_FIELDS;
export type BookingTemplateField = (typeof BOOKING_TEMPLATE_FIELDS)[number];

export type BookingTemplatePreferences = {
  introduction: string;
  closing: string;
  enabledFields: BookingTemplateField[];
};

export type ParsedBookingText = {
  name: string;
  phone: string;
  instagram: string;
  email: string;
  service: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  notes: string;
  customResponses: BookingQuestionResponse[];
  serviceOptions: Record<string, string>;
  warnings: string[];
};

export type MatchResult<T> =
  | { kind: "none"; matches: [] }
  | { kind: "exact"; matches: [T] }
  | { kind: "ambiguous"; matches: T[] };

export const DEFAULT_BOOKING_TEMPLATE_PREFERENCES: BookingTemplatePreferences = {
  introduction: DEFAULT_BOOKING_QUESTIONNAIRE.introduction,
  closing: DEFAULT_BOOKING_QUESTIONNAIRE.closing,
  enabledFields: [...BOOKING_TEMPLATE_FIELDS],
};

const FIELD_ALIASES: Record<BookingTemplateField, string[]> = {
  name: ["name", "nama", "client", "client name", "nama client", "nama klien"],
  phone: ["phone", "phone number", "whatsapp", "wa", "no wa", "nomor wa", "nomor telepon", "telepon", "no hp", "nomor hp"],
  instagram: ["instagram", "instagram username", "ig", "username instagram"],
  email: ["email", "e-mail"],
  service: ["service", "layanan", "jasa", "jenis layanan"],
  date: ["date", "tanggal", "booking date", "tanggal booking"],
  startTime: ["start time", "time", "jam", "jam mulai", "waktu mulai"],
  endTime: ["end time", "jam selesai", "waktu selesai"],
  location: ["location", "lokasi", "alamat", "venue"],
  notes: ["notes", "note", "catatan", "keterangan", "request", "permintaan"],
};

const INDONESIAN_MONTHS: Record<string, number> = {
  januari: 1, january: 1, jan: 1,
  februari: 2, february: 2, feb: 2,
  maret: 3, march: 3, mar: 3,
  april: 4, apr: 4,
  mei: 5, may: 5,
  juni: 6, june: 6, jun: 6,
  juli: 7, july: 7, jul: 7,
  agustus: 8, august: 8, aug: 8, agu: 8,
  september: 9, sep: 9, sept: 9,
  oktober: 10, october: 10, oct: 10, okt: 10,
  november: 11, nov: 11,
  desember: 12, december: 12, dec: 12, des: 12,
};

const normalizeLabel = normalizeQuestionLabel;

function fieldForLabel(label: string): BookingTemplateField | null {
  const normalized = normalizeLabel(label);
  for (const field of BOOKING_TEMPLATE_FIELDS) {
    if (FIELD_ALIASES[field].includes(normalized)) return field;
  }
  return null;
}

function validDateKey(year: number, month: number, day: number): string {
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) return "";
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseBookingDate(value: string): string {
  const source = value.normalize("NFKC").trim().replace(/,/g, "");
  const iso = source.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return validDateKey(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const numeric = source.match(/^(\d{1,2})[\s/.-](\d{1,2})[\s/.-](\d{4})$/);
  if (numeric) return validDateKey(Number(numeric[3]), Number(numeric[2]), Number(numeric[1]));
  const words = source.toLowerCase().match(/^(\d{1,2})\s+([\p{L}.]+)\s+(\d{4})$/u);
  if (!words) return "";
  const month = INDONESIAN_MONTHS[words[2].replaceAll(".", "")];
  return month ? validDateKey(Number(words[3]), month, Number(words[1])) : "";
}

export function parseBookingTime(value: string): string {
  const source = value.normalize("NFKC").trim().toLowerCase().replace(".", ":");
  const match = source.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return "";
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? "0");
  if (minute > 59 || hour > (match[3] ? 12 : 23) || hour < 0 || (match[3] && hour === 0)) return "";
  if (match[3] === "am" && hour === 12) hour = 0;
  if (match[3] === "pm" && hour !== 12) hour += 12;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function normalizeBookingPhone(value: string): string {
  return normalizeClientPhone(value);
}

export function normalizeBookingInstagram(value: string): string {
  return normalizeClientInstagram(value);
}

export function parseBookingText(value: string, questions: readonly BookingQuestion[] = [], services: readonly Service[] = []): ParsedBookingText {
  const fields: Omit<ParsedBookingText, "warnings"> = { name: "", phone: "", instagram: "", email: "", service: "", date: "", startTime: "", endTime: "", location: "", notes: "", customResponses: [], serviceOptions: {} };
  const warnings: string[] = [];
  const questionsByLabel = new Map(questions.filter((question) => question.active).map((question) => [normalizeLabel(question.label), question]));
  const optionGroupsByLabel = new Map(services.flatMap((service) => (service.optionGroups ?? []).map((group) => [normalizeLabel(group.name), group] as const)));
  for (const rawLine of value.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const divider = line.indexOf(":");
    if (divider < 0) continue;
    const label = line.slice(0, divider);
    const field = fieldForLabel(label);
    const optionGroup = field ? null : optionGroupsByLabel.get(normalizeLabel(label));
    const question = field || optionGroup ? null : questionsByLabel.get(normalizeLabel(label));
    if (!field && !question && !optionGroup) continue;
    const raw = line.slice(divider + 1).trim();
    if (optionGroup) {
      fields.serviceOptions[normalizeLabel(optionGroup.name)] = raw;
    } else if (question) {
      const parsed = parseCustomQuestionAnswer(question, raw);
      if (parsed.answer !== null) {
        const response = responseForQuestion(question, parsed.answer);
        fields.customResponses = fields.customResponses.some((item) => item.questionId === question.id)
          ? fields.customResponses.map((item) => item.questionId === question.id ? response : item)
          : [...fields.customResponses, response];
      }
      if (parsed.warning) warnings.push(parsed.warning);
    } else if (field === "date") {
      fields.date = parseBookingDate(raw);
      if (raw && !fields.date) warnings.push("Review the date - Qai could not read it safely.");
    } else if (field === "startTime" || field === "endTime") {
      fields[field] = parseBookingTime(raw);
      if (raw && !fields[field]) warnings.push(`Review the ${field === "startTime" ? "start" : "end"} time - Qai could not read it safely.`);
    } else if (field === "phone") {
      fields.phone = raw;
    } else if (field === "instagram") {
      fields.instagram = raw ? `@${normalizeBookingInstagram(raw)}` : "";
    } else if (field) {
      fields[field] = raw;
    }
  }
  for (const [field, label] of [["name", "client name"], ["phone", "phone"], ["service", "service"], ["date", "date"], ["startTime", "start time"]] as const) {
    if (!fields[field]) warnings.push(`Add or review the ${label}.`);
  }
  return { ...fields, warnings: [...new Set(warnings)] };
}

function parseCustomQuestionAnswer(question: BookingQuestion, raw: string): { answer: BookingQuestionResponse["answer"] | null; warning: string } {
  if (!raw) return { answer: null, warning: question.required ? `Add or review ${question.label}.` : "" };
  if (["Short text", "Long text", "Address / location"].includes(question.type)) return { answer: raw, warning: "" };
  if (question.type === "Number") {
    const answer = Number(raw.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(answer) ? { answer, warning: "" } : { answer: null, warning: `Review ${question.label} - Qai could not read the number safely.` };
  }
  if (question.type === "Yes / No") {
    const normalized = normalizeLabel(raw);
    if (["yes", "y", "true", "ya", "iya"].includes(normalized)) return { answer: true, warning: "" };
    if (["no", "n", "false", "tidak", "nggak", "tidak boleh"].includes(normalized)) return { answer: false, warning: "" };
    return { answer: null, warning: `Review ${question.label} - choose Yes or No.` };
  }
  if (question.type === "Date") {
    const answer = parseBookingDate(raw);
    return answer ? { answer, warning: "" } : { answer: null, warning: `Review ${question.label} - Qai could not read the date safely.` };
  }
  if (question.type === "Time") {
    const answer = parseBookingTime(raw);
    return answer ? { answer, warning: "" } : { answer: null, warning: `Review ${question.label} - Qai could not read the time safely.` };
  }
  if (question.type === "Single choice") {
    const answer = question.options.find((option) => normalizeLabel(option) === normalizeLabel(raw));
    return answer ? { answer, warning: "" } : { answer: null, warning: `Review ${question.label} - the answer does not match an available choice.` };
  }
  if (question.type === "Multiple choice") {
    const requested = raw.split(/[,;]/).map((item) => normalizeLabel(item)).filter(Boolean);
    const selected = requested.map((item) => question.options.find((option) => normalizeLabel(option) === item)).filter((item): item is string => Boolean(item));
    return requested.length > 0 && selected.length === requested.length
      ? { answer: [...new Set(selected)], warning: "" }
      : { answer: null, warning: `Review ${question.label} - one or more choices were not recognized.` };
  }
  return { answer: null, warning: `Review ${question.label} and attach the file in the Booking form.` };
}

export function matchExistingCustomer(parsed: Partial<Pick<ParsedBookingText, "name" | "phone" | "instagram" | "email">>, customers: Customer[]): MatchResult<Customer> {
  const matches = findClientMatches(parsed, customers);
  const strong = matches.filter((match) => match.strong);
  if (strong.length > 0) {
    const highest = strong.filter((match) => match.score === strong[0].score).map((match) => match.customer);
    if (highest.length === 1) return { kind: "exact", matches: [highest[0]] };
    return { kind: "ambiguous", matches: highest };
  }
  const weak = matches.map((match) => match.customer);
  return weak.length > 0 ? { kind: "ambiguous", matches: weak } : { kind: "none", matches: [] };
}

export function matchExistingService(serviceText: string, services: Service[]): MatchResult<Service> {
  const normalized = normalizeLabel(serviceText);
  if (!normalized) return { kind: "none", matches: [] };
  const matches = services.filter((service) => normalizeLabel(service.name) === normalized);
  if (matches.length === 1) return { kind: "exact", matches: [matches[0]] };
  if (matches.length > 1) return { kind: "ambiguous", matches };
  return { kind: "none", matches: [] };
}

export function matchParsedServiceVariant(parsed: ParsedBookingText, service: Service | null): MatchResult<ServiceVariant> {
  if (!service || !(service.optionGroups ?? []).length) return { kind: "none", matches: [] };
  const selectedIds = (service.optionGroups ?? []).flatMap((group) => {
    const requested = parsed.serviceOptions[normalizeLabel(group.name)];
    if (!requested) return [];
    const value = group.values.find((candidate) => candidate.active && normalizeLabel(candidate.label) === normalizeLabel(requested));
    return value ? [value.id] : [];
  });
  if (selectedIds.length !== (service.optionGroups ?? []).length) return { kind: "none", matches: [] };
  const matches = (service.variants ?? []).filter((variant) => variant.active && selectedIds.every((id) => variant.optionValueIds.includes(id)) && variant.optionValueIds.length === selectedIds.length);
  if (matches.length === 1) return { kind: "exact", matches: [matches[0]] };
  return matches.length > 1 ? { kind: "ambiguous", matches } : { kind: "none", matches: [] };
}

export function formatBookingClientTemplate(
  businessName: string,
  preferences: BookingTemplatePreferences | BookingQuestionnaireDefinition,
  serviceOrId: string | Service = "",
): string {
  const serviceId = typeof serviceOrId === "string" ? serviceOrId : serviceOrId.id;
  const enabledFields = "enabledCoreFields" in preferences ? preferences.enabledCoreFields : preferences.enabledFields;
  const rows = enabledFields.map((field) => `${BOOKING_CORE_FIELD_LABELS[field]}:`);
  const optionRows = typeof serviceOrId === "string" ? [] : (serviceOrId.optionGroups ?? []).map((group) => `${group.name}:`);
  const questionRows = "questions" in preferences ? questionsForService(preferences, serviceId).map((question) => question.type === "File / image" ? `${question.label}: Please upload this through our Booking Page.` : `${question.label}:`) : [];
  return [preferences.introduction.trim() || `Booking form - ${businessName}`, ...rows, ...optionRows, ...questionRows, preferences.closing.trim()].filter(Boolean).join("\n\n");
}
