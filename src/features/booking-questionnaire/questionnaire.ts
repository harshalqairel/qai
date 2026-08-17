import { z } from "zod";

export const BOOKING_CORE_FIELDS = [
  "name",
  "phone",
  "instagram",
  "email",
  "service",
  "date",
  "startTime",
  "endTime",
  "location",
  "notes",
] as const;

export const BOOKING_CORE_FIELD_LABELS: Record<BookingCoreField, string> = {
  name: "Name",
  phone: "Phone",
  instagram: "Instagram",
  email: "Email",
  service: "Service",
  date: "Date",
  startTime: "Start time",
  endTime: "End time",
  location: "Location",
  notes: "Notes",
};

export const BOOKING_QUESTION_TYPES = [
  "Short text",
  "Long text",
  "Number",
  "Yes / No",
  "Single choice",
  "Multiple choice",
  "Date",
  "Time",
  "Address / location",
  "File / image",
] as const;

export type BookingCoreField = (typeof BOOKING_CORE_FIELDS)[number];
export type BookingQuestionType = (typeof BOOKING_QUESTION_TYPES)[number];

export const bookingQuestionFileAnswerSchema = z.object({
  url: z.string().min(1).max(3_000_000),
  name: z.string().trim().min(1).max(240),
  mimeType: z.string().trim().min(1).max(120),
  size: z.number().int().positive().max(8 * 1024 * 1024),
});

export type BookingQuestionFileAnswer = z.infer<typeof bookingQuestionFileAnswerSchema>;

export const bookingQuestionSchema = z.object({
  id: z.string().min(1).max(100),
  label: z.string().trim().min(1).max(160),
  helperText: z.string().trim().max(500),
  type: z.enum(BOOKING_QUESTION_TYPES),
  required: z.boolean(),
  options: z.array(z.string().trim().min(1).max(120)).max(20),
  active: z.boolean(),
  order: z.number().int().min(0).max(1000),
  serviceIds: z.array(z.string().min(1).max(100)).max(100),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
}).superRefine((question, context) => {
  if (["Single choice", "Multiple choice"].includes(question.type) && question.options.length < 1) {
    context.addIssue({ code: "custom", path: ["options"], message: "Add at least one choice." });
  }
  const normalized = question.options.map(normalizeQuestionLabel);
  if (new Set(normalized).size !== normalized.length) {
    context.addIssue({ code: "custom", path: ["options"], message: "Choice options must be unique." });
  }
});

export const bookingQuestionnaireDefinitionSchema = z.object({
  businessId: z.string().min(1).max(100),
  introduction: z.string().trim().max(1000),
  closing: z.string().trim().max(1000),
  enabledCoreFields: z.array(z.enum(BOOKING_CORE_FIELDS)).max(BOOKING_CORE_FIELDS.length),
  questions: z.array(bookingQuestionSchema).max(50),
  updatedAt: z.number().int().nonnegative(),
}).superRefine((definition, context) => {
  const coreFields = definition.enabledCoreFields;
  if (new Set(coreFields).size !== coreFields.length) {
    context.addIssue({ code: "custom", path: ["enabledCoreFields"], message: "Core fields must be unique." });
  }
  const ids = definition.questions.map((question) => question.id);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: "custom", path: ["questions"], message: "Question IDs must be unique." });
  }
  const labels = definition.questions.map((question) => normalizeQuestionLabel(question.label));
  if (new Set(labels).size !== labels.length) {
    context.addIssue({ code: "custom", path: ["questions"], message: "Question labels must be unique." });
  }
});

export const bookingQuestionResponseSchema = z.object({
  questionId: z.string().min(1).max(100),
  labelSnapshot: z.string().trim().min(1).max(160),
  typeSnapshot: z.enum(BOOKING_QUESTION_TYPES),
  answer: z.union([
    z.string().max(5000),
    z.number().finite(),
    z.boolean(),
    z.array(z.string().max(120)).max(20),
    bookingQuestionFileAnswerSchema,
  ]),
});

export type BookingQuestion = z.infer<typeof bookingQuestionSchema>;
export type BookingQuestionnaireDefinition = z.infer<typeof bookingQuestionnaireDefinitionSchema>;
export type BookingQuestionResponse = z.infer<typeof bookingQuestionResponseSchema>;

export const DEFAULT_BOOKING_QUESTIONNAIRE: BookingQuestionnaireDefinition = {
  businessId: "local-business",
  introduction: "Booking form - please complete the details below.",
  closing: "Thank you. I will confirm the schedule and price after reviewing your details.",
  enabledCoreFields: [...BOOKING_CORE_FIELDS],
  questions: [],
  updatedAt: 0,
};

export function normalizeQuestionLabel(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
}

const CORE_FIELD_ALIASES: Record<BookingCoreField, readonly string[]> = {
  name: ["name", "nama", "client", "client name", "nama client", "nama klien"],
  phone: ["phone", "phone number", "whatsapp", "wa", "no wa", "nomor wa", "no hp", "no. hp", "nomor hp", "nomor whatsapp"],
  instagram: ["instagram", "instagram username", "username instagram", "ig"],
  email: ["email", "e mail", "email address", "alamat email"],
  service: ["service", "layanan", "jasa", "jenis layanan"],
  date: ["date", "tanggal", "booking date", "tanggal booking"],
  startTime: ["start time", "time", "jam", "jam mulai", "waktu mulai"],
  endTime: ["end time", "jam selesai", "waktu selesai"],
  location: ["location", "lokasi", "alamat", "venue"],
  notes: ["notes", "note", "catatan", "keterangan", "request", "permintaan"],
};

export function coreFieldForQuestionLabel(value: string): BookingCoreField | null {
  const normalized = normalizeQuestionLabel(value).replace(/[^\p{L}\p{N} ]/gu, "").replace(/\s+/g, " ").trim();
  for (const field of BOOKING_CORE_FIELDS) {
    if (CORE_FIELD_ALIASES[field].some((alias) => normalizeQuestionLabel(alias).replace(/[^\p{L}\p{N} ]/gu, "") === normalized)) return field;
  }
  return null;
}

export function questionsForService(
  definition: BookingQuestionnaireDefinition,
  serviceId: string,
  includeInactive = false,
): BookingQuestion[] {
  const enabledCoreFields = new Set(definition.enabledCoreFields);
  return [...definition.questions]
    .filter((question) => {
      const duplicateCoreField = coreFieldForQuestionLabel(question.label);
      return (includeInactive || question.active)
        && (!serviceId || question.serviceIds.length === 0 || question.serviceIds.includes(serviceId))
        && (includeInactive || !duplicateCoreField || !enabledCoreFields.has(duplicateCoreField));
    })
    .sort((left, right) => left.order - right.order || left.createdAt - right.createdAt);
}

export function responseForQuestion(
  question: BookingQuestion,
  answer: BookingQuestionResponse["answer"],
): BookingQuestionResponse {
  return {
    questionId: question.id,
    labelSnapshot: question.label,
    typeSnapshot: question.type,
    answer,
  };
}

export function answerIsEmpty(answer: BookingQuestionResponse["answer"] | undefined): boolean {
  if (answer === undefined) return true;
  if (typeof answer === "string") return answer.trim().length === 0;
  if (Array.isArray(answer)) return answer.length === 0;
  return false;
}

export function validateQuestionnaireResponses(
  definition: BookingQuestionnaireDefinition,
  serviceId: string,
  responses: readonly BookingQuestionResponse[],
  rejectUnexpected = false,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const byQuestion = new Map(responses.map((response) => [response.questionId, response]));
  const applicableQuestions = questionsForService(definition, serviceId);
  const applicableById = new Map(applicableQuestions.map((question) => [question.id, question]));
  if (rejectUnexpected) {
    if (byQuestion.size !== responses.length) errors._responses = "Each question may be answered once.";
    for (const response of responses) {
      const question = applicableById.get(response.questionId);
      if (!question || response.labelSnapshot !== question.label || response.typeSnapshot !== question.type) errors[response.questionId] = "This question is not available.";
    }
  }
  for (const question of applicableQuestions) {
    const response = byQuestion.get(question.id);
    if (!response || answerIsEmpty(response.answer)) {
      if (question.required) errors[question.id] = `Answer ${question.label}.`;
      continue;
    }
    const answer = response.answer;
    if (question.type === "Number" && typeof answer !== "number") errors[question.id] = "Enter a valid number.";
    if (question.type === "Yes / No" && typeof answer !== "boolean") errors[question.id] = "Choose Yes or No.";
    if (question.type === "Single choice" && (typeof answer !== "string" || !question.options.includes(answer))) errors[question.id] = "Choose one of the available options.";
    if (question.type === "Multiple choice" && (!Array.isArray(answer) || answer.some((option) => !question.options.includes(option)))) errors[question.id] = "Choose only from the available options.";
    if (question.type === "Date" && (typeof answer !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(answer))) errors[question.id] = "Enter a valid date.";
    if (question.type === "Time" && (typeof answer !== "string" || !/^\d{2}:\d{2}$/.test(answer))) errors[question.id] = "Enter a valid time.";
    if (question.type === "File / image") {
      const parsedFile = bookingQuestionFileAnswerSchema.safeParse(answer);
      if (!parsedFile.success || !["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(parsedFile.data.mimeType)) errors[question.id] = "Upload a supported file.";
    }
  }
  return errors;
}

export function mergeQuestionResponse(
  responses: readonly BookingQuestionResponse[],
  response: BookingQuestionResponse,
): BookingQuestionResponse[] {
  return responses.some((item) => item.questionId === response.questionId)
    ? responses.map((item) => item.questionId === response.questionId ? response : item)
    : [...responses, response];
}
