import { instantParts, zonedDateTimeToIso } from "@/features/booking/utils/bookingSessions";
import type {
  ServiceAvailability,
  ServiceDatedSession,
  ServiceRecurringTime,
} from "@/features/service/types";

export const DEFAULT_SERVICE_AVAILABILITY: ServiceAvailability = {
  mode: "Flexible",
  capacityMode: "One booking",
  defaultCapacity: 1,
  recurringTimes: [],
  datedSessions: [],
  overrides: [],
};

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export type ResolvedServiceSlot = {
  key: string;
  sourceId: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  capacity: number;
  manualBlocked: number;
};

export type ServiceSlotAvailability = ResolvedServiceSlot & {
  confirmedBookings: number;
  remaining: number;
  full: boolean;
};

export function normalizeServiceAvailability(value?: ServiceAvailability | null): ServiceAvailability {
  return value ? {
    mode: value.mode ?? "Flexible",
    capacityMode: value.capacityMode ?? "One booking",
    defaultCapacity: Math.max(1, Math.trunc(value.defaultCapacity || 1)),
    recurringTimes: value.recurringTimes ?? [],
    datedSessions: value.datedSessions ?? [],
    overrides: value.overrides ?? [],
  } : structuredClone(DEFAULT_SERVICE_AVAILABILITY);
}

export function serviceSlotKey(serviceId: string, sourceId: string, date: string, startTime: string): string {
  return `${encodeURIComponent(serviceId)}|${encodeURIComponent(sourceId)}|${date}T${startTime}`;
}

export function weekdayForDate(date: string): number {
  const day = new Date(`${date}T12:00:00.000Z`).getUTCDay();
  return (day + 6) % 7;
}

function capacityFor(availability: ServiceAvailability, override: number | null): number {
  return availability.capacityMode === "One booking" ? 1 : Math.max(1, Math.trunc(override ?? availability.defaultCapacity));
}

function endTimeFor(date: string, startTime: string, durationMinutes: number, timezone: string): string {
  const startAt = zonedDateTimeToIso(date, startTime, timezone);
  return instantParts(new Date(Date.parse(startAt) + durationMinutes * 60_000).toISOString(), timezone).time;
}

function resolveRecurring(
  serviceId: string,
  availability: ServiceAvailability,
  slot: ServiceRecurringTime,
  date: string,
  durationMinutes: number,
  timezone: string,
): ResolvedServiceSlot | null {
  const override = availability.overrides.find((item) => item.date === date && item.startTime === slot.startTime);
  if (override?.unavailable) return null;
  return {
    key: serviceSlotKey(serviceId, slot.id, date, slot.startTime),
    sourceId: slot.id,
    date,
    startTime: slot.startTime,
    endTime: endTimeFor(date, slot.startTime, durationMinutes, timezone),
    location: "",
    capacity: capacityFor(availability, override?.capacity ?? slot.capacity),
    manualBlocked: Math.max(0, slot.manualBlocked + (override?.manualBlocked ?? 0)),
  };
}

function resolveDated(serviceId: string, availability: ServiceAvailability, slot: ServiceDatedSession): ResolvedServiceSlot {
  return {
    key: serviceSlotKey(serviceId, slot.id, slot.date, slot.startTime),
    sourceId: slot.id,
    date: slot.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
    location: slot.location,
    capacity: capacityFor(availability, slot.capacity),
    manualBlocked: Math.max(0, slot.manualBlocked),
  };
}

export function serviceSlotsForDate(
  serviceId: string,
  input: ServiceAvailability | undefined,
  date: string,
  durationMinutes: number,
  timezone: string,
): ResolvedServiceSlot[] {
  const availability = normalizeServiceAvailability(input);
  if (availability.mode === "Flexible") return [];
  const slots = availability.mode === "Recurring times"
    ? availability.recurringTimes
        .filter((slot) => slot.weekday === weekdayForDate(date))
        .map((slot) => resolveRecurring(serviceId, availability, slot, date, durationMinutes, timezone))
        .filter((slot): slot is ResolvedServiceSlot => slot !== null)
    : availability.datedSessions
        .filter((slot) => slot.active && slot.date === date)
        .map((slot) => resolveDated(serviceId, availability, slot));
  return slots.sort((left, right) => left.startTime.localeCompare(right.startTime));
}

export function calculateServiceSlotAvailability(slot: ResolvedServiceSlot, confirmedBookings: number): ServiceSlotAvailability {
  const remaining = Math.max(0, slot.capacity - slot.manualBlocked - Math.max(0, confirmedBookings));
  return { ...slot, confirmedBookings: Math.max(0, confirmedBookings), remaining, full: remaining === 0 };
}

export function findServiceSlot(
  serviceId: string,
  input: ServiceAvailability | undefined,
  date: string,
  startTime: string,
  durationMinutes: number,
  timezone: string,
): ResolvedServiceSlot | null {
  return serviceSlotsForDate(serviceId, input, date, durationMinutes, timezone).find((slot) => slot.startTime === startTime) ?? null;
}
