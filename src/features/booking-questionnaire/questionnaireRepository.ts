"use client";

import { createClient } from "@/lib/supabase/client";
import { getActiveBusinessContext } from "@/lib/supabase/cloudRepositories";
import { isCloudModeEnabled } from "@/lib/supabase/config";
import { readVersionedCollection, writeVersionedCollection } from "@/lib/persistence";
import {
  BOOKING_CORE_FIELDS,
  DEFAULT_BOOKING_QUESTIONNAIRE,
  bookingQuestionnaireDefinitionSchema,
  type BookingCoreField,
  type BookingQuestionnaireDefinition,
} from "./questionnaire";

export const BOOKING_QUESTIONNAIRE_STORAGE_KEY = "qai:booking-questionnaire";
const LEGACY_TEMPLATE_STORAGE_KEY = "qai:booking-client-template";

function localDefinition(): BookingQuestionnaireDefinition {
  const stored = readVersionedCollection(BOOKING_QUESTIONNAIRE_STORAGE_KEY, bookingQuestionnaireDefinitionSchema)[0];
  if (stored) return stored;
  if (typeof window === "undefined") return structuredClone(DEFAULT_BOOKING_QUESTIONNAIRE);
  try {
    const legacy = JSON.parse(window.localStorage.getItem(LEGACY_TEMPLATE_STORAGE_KEY) ?? "null") as {
      introduction?: unknown;
      closing?: unknown;
      enabledFields?: unknown;
    } | null;
    if (!legacy) return structuredClone(DEFAULT_BOOKING_QUESTIONNAIRE);
    const enabledCoreFields = Array.isArray(legacy.enabledFields)
      ? legacy.enabledFields.filter((field): field is BookingCoreField => BOOKING_CORE_FIELDS.includes(field as BookingCoreField))
      : [...BOOKING_CORE_FIELDS];
    return bookingQuestionnaireDefinitionSchema.parse({
      ...DEFAULT_BOOKING_QUESTIONNAIRE,
      introduction: typeof legacy.introduction === "string" ? legacy.introduction : DEFAULT_BOOKING_QUESTIONNAIRE.introduction,
      closing: typeof legacy.closing === "string" ? legacy.closing : DEFAULT_BOOKING_QUESTIONNAIRE.closing,
      enabledCoreFields: enabledCoreFields.length ? [...new Set(enabledCoreFields)] : [...BOOKING_CORE_FIELDS],
    });
  } catch {
    return structuredClone(DEFAULT_BOOKING_QUESTIONNAIRE);
  }
}

export function getBookingQuestionnaire(): BookingQuestionnaireDefinition {
  return localDefinition();
}

export async function loadBookingQuestionnaire(): Promise<BookingQuestionnaireDefinition> {
  if (!isCloudModeEnabled()) return localDefinition();
  const { businessId } = await getActiveBusinessContext();
  const { data, error } = await createClient().from("booking_questionnaires").select("definition, updated_at").eq("business_id", businessId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { ...DEFAULT_BOOKING_QUESTIONNAIRE, businessId };
  return bookingQuestionnaireDefinitionSchema.parse({ ...(data.definition as object), businessId, updatedAt: Date.parse(data.updated_at) || Date.now() });
}

export async function saveBookingQuestionnaire(definition: BookingQuestionnaireDefinition): Promise<BookingQuestionnaireDefinition> {
  const parsed = bookingQuestionnaireDefinitionSchema.parse({ ...definition, updatedAt: Date.now() });
  if (isCloudModeEnabled()) {
    const { businessId } = await getActiveBusinessContext();
    const payload = { ...parsed, businessId };
    const { error } = await createClient().from("booking_questionnaires").upsert({ business_id: businessId, definition: payload, updated_at: new Date(payload.updatedAt).toISOString() }, { onConflict: "business_id" });
    if (error) throw new Error(error.message);
    return payload;
  }
  writeVersionedCollection(BOOKING_QUESTIONNAIRE_STORAGE_KEY, bookingQuestionnaireDefinitionSchema, [parsed]);
  return parsed;
}
