import type { Booking, BookingSession } from "@/features/booking/types";
import { mergePublicServices } from "@/features/qai-page/publicServiceSync";
import type { QaiPageConfig } from "@/features/qai-page/validation";
import type { Service } from "@/features/service/types";

type Row = Record<string, unknown>;

function text(row: Row, key: string): string {
  return typeof row[key] === "string" ? row[key] as string : "";
}

function number(row: Row, key: string): number {
  const value = Number(row[key]);
  return Number.isFinite(value) ? value : 0;
}

function timestamp(value: unknown): number {
  const parsed = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

export function cloudServiceFromRow(row: Row): Service {
  return {
    id: text(row, "id"),
    name: text(row, "name"),
    categoryId: text(row, "category_id"),
    price: number(row, "price"),
    duration: number(row, "duration_minutes"),
    defaultSessionCount: number(row, "default_session_count") || 1,
    locationPolicy: (text(row, "location_policy") || "Client can choose") as Service["locationPolicy"],
    optionGroups: Array.isArray(row.option_groups) ? row.option_groups as Service["optionGroups"] : [],
    variants: Array.isArray(row.variants) ? row.variants as Service["variants"] : [],
    availability: row.availability && typeof row.availability === "object" && !Array.isArray(row.availability)
      ? row.availability as Service["availability"]
      : undefined,
    description: text(row, "description"),
    active: row.active === true,
  };
}

export function materializeCloudPage(
  page: QaiPageConfig,
  serviceRows: readonly Row[],
  includeInactive = false,
): QaiPageConfig {
  return {
    ...page,
    services: mergePublicServices(page.services, serviceRows.map(cloudServiceFromRow), { includeInactive }),
  };
}

export function cloudBookingsForCapacity(bookingRows: readonly Row[], sessionRows: readonly Row[]): Booking[] {
  const sessionsByBooking = new Map<string, BookingSession[]>();
  for (const row of sessionRows) {
    const bookingId = text(row, "booking_id");
    const grouped = sessionsByBooking.get(bookingId) ?? [];
    grouped.push({
      id: text(row, "id"),
      bookingId,
      sequence: number(row, "sequence"),
      label: text(row, "label"),
      startAt: text(row, "start_at"),
      endAt: text(row, "end_at"),
      location: text(row, "location"),
      notes: text(row, "notes"),
      createdAt: timestamp(row.created_at),
      updatedAt: timestamp(row.updated_at),
    });
    sessionsByBooking.set(bookingId, grouped);
  }
  return bookingRows.map((row) => ({
    id: text(row, "id"),
    customerId: text(row, "customer_id"),
    serviceId: text(row, "service_id"),
    sessions: (sessionsByBooking.get(text(row, "id")) ?? []).sort((left, right) => left.sequence - right.sequence),
    servicePrice: number(row, "service_price"),
    serviceSnapshot: row.service_snapshot && typeof row.service_snapshot === "object" && !Array.isArray(row.service_snapshot)
      ? row.service_snapshot as Booking["serviceSnapshot"]
      : null,
    additionalCharges: [],
    questionnaireResponses: [],
    capacitySourceRequestId: typeof row.capacity_source_request_id === "string" ? row.capacity_source_request_id : null,
    capacitySlotKeys: Array.isArray(row.capacity_slot_keys) ? row.capacity_slot_keys.filter((value): value is string => typeof value === "string") : [],
    bookingStatus: text(row, "booking_status") as Booking["bookingStatus"],
    fullPaymentDueDate: text(row, "full_payment_due_date"),
    notes: text(row, "notes"),
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
  }));
}
