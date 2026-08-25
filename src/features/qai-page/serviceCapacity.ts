import type { Booking } from "@/features/booking/types";
import { instantParts } from "@/features/booking/utils/bookingSessions";
import {
  calculateServiceSlotAvailability,
  findServiceSlot,
  normalizeServiceAvailability,
  serviceSlotsForDate,
  type ServiceSlotAvailability,
} from "@/features/service/domain/serviceAvailability";
import { publicVariantForId, type PublicRequest, type PublicService } from "@/features/qai-page/validation";

function incrementOnce(counts: Map<string, number>, keys: readonly string[]) {
  for (const key of new Set(keys)) counts.set(key, (counts.get(key) ?? 0) + 1);
}

function stableSlotKey(value: string | undefined): value is string {
  return Boolean(value && value.includes("|") && /\|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value));
}

function requestSlotKeys(service: PublicService, request: PublicRequest, timezone: string): string[] {
  const stored = request.availabilityKeys?.length ? request.availabilityKeys : request.availabilityKey ? [request.availabilityKey] : [];
  const duration = request.serviceSnapshot?.duration ?? publicVariantForId(service, request.serviceVariantId)?.duration ?? service.durationMinutes;
  return request.schedules.flatMap((schedule, index) => {
    if (stableSlotKey(stored[index])) return [stored[index]];
    const slot = findServiceSlot(service.serviceId, service.availability, schedule.date, schedule.startTime, duration, timezone);
    return slot ? [slot.key] : [];
  });
}

function bookingSlotKeys(service: PublicService, booking: Booking, timezone: string): string[] {
  // Legacy bookings predate capacity snapshots. Resolve them only when they still
  // match a current configured slot; the booking record itself remains untouched.
  const duration = booking.serviceSnapshot?.duration ?? service.durationMinutes;
  return booking.sessions.flatMap((session, index) => {
    const stored = booking.capacitySlotKeys?.[index];
    if (stableSlotKey(stored)) return [stored];
    const local = instantParts(session.startAt, timezone);
    const slot = findServiceSlot(service.serviceId, service.availability, local.date, local.time, duration, timezone);
    return slot ? [slot.key] : [];
  });
}

export function bookingCapacitySourceRequestIds(bookings: readonly Booking[]): string[] {
  return [...new Set(bookings.flatMap((booking) => booking.capacitySourceRequestId ? [booking.capacitySourceRequestId] : []))];
}

export function confirmedServiceSlotCounts(
  service: PublicService,
  requests: readonly PublicRequest[],
  bookings: readonly Booking[] | undefined,
  timezone: string,
): Map<string, number> {
  const counts = new Map<string, number>();
  const authoritativeBookings = bookings !== undefined;
  const replacedRequestIds = new Set(authoritativeBookings ? bookingCapacitySourceRequestIds(bookings) : []);

  for (const request of requests) {
    if (request.serviceId !== service.serviceId || request.status !== "Accepted") continue;
    if (authoritativeBookings && (request.bookingId || replacedRequestIds.has(request.id))) continue;
    incrementOnce(counts, requestSlotKeys(service, request, timezone));
  }

  for (const booking of bookings ?? []) {
    if (booking.serviceId !== service.serviceId || booking.bookingStatus === "Cancelled") continue;
    incrementOnce(counts, bookingSlotKeys(service, booking, timezone));
  }
  return counts;
}

export function directBookingSlotCounts(
  service: PublicService,
  bookings: readonly Booking[],
  timezone: string,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const booking of bookings) {
    if (booking.serviceId !== service.serviceId || booking.bookingStatus === "Cancelled") continue;
    incrementOnce(counts, bookingSlotKeys(service, booking, timezone));
  }
  return counts;
}

export function availableServiceSlotsForDate(input: {
  service: PublicService;
  variantId: string | null;
  date: string;
  timezone: string;
  requests: readonly PublicRequest[];
  bookings?: readonly Booking[];
  durationMinutes?: number;
}): ServiceSlotAvailability[] {
  const variant = publicVariantForId(input.service, input.variantId);
  const duration = input.durationMinutes ?? variant?.duration ?? input.service.durationMinutes;
  const counts = confirmedServiceSlotCounts(input.service, input.requests, input.bookings, input.timezone);
  return serviceSlotsForDate(input.service.serviceId, normalizeServiceAvailability(input.service.availability), input.date, duration, input.timezone)
    .map((slot) => calculateServiceSlotAvailability(slot, counts.get(slot.key) ?? 0));
}
