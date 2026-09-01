import type { Booking, BookingSession } from "@/features/booking/types";
import { instantParts } from "@/features/booking/utils/bookingSessions";
import { calculateServiceSlotAvailability, serviceSlotsForDate } from "@/features/service/domain/serviceAvailability";
import type { Service } from "@/features/service/types";
import type { DerivedPaymentStatus } from "@/features/payment/types";

export type UpcomingBooking = Booking & {
  customerName: string;
  serviceName: string;
  paymentStatus: DerivedPaymentStatus;
};

export type ScheduledSessionItem = UpcomingBooking & {
  session: BookingSession;
};

type GroupPaymentSummary = {
  paidCount: number;
  unpaidCount: number;
  label: string;
};

export type IndividualUpcomingJob = {
  kind: "individual";
  item: ScheduledSessionItem;
  startAt: string;
};

export type GroupUpcomingJob = {
  kind: "group";
  key: string;
  serviceId: string;
  serviceName: string;
  session: BookingSession;
  bookings: ScheduledSessionItem[];
  payment: GroupPaymentSummary;
  capacity: {
    booked: number;
    total: number | null;
    reserved: number;
    available: number | null;
  };
  participants: string[];
  startAt: string;
};

export type UpcomingJob = IndividualUpcomingJob | GroupUpcomingJob;

function stableSlotKeyFor(booking: UpcomingBooking, session: BookingSession, sessionIndex: number, service: Service, timezone: string): string | null {
  const key = booking.capacitySlotKeys?.[sessionIndex];
  if (key) try {
    const parts = key.split("|");
    if (parts.length === 3) {
      const local = instantParts(session.startAt, timezone);
      const persisted = decodeURIComponent(parts[0]) === booking.serviceId
        && Boolean(decodeURIComponent(parts[1]))
        && parts[2] === `${local.date}T${local.time}`
        ? key
        : null;
      if (persisted) return persisted;
    }
  } catch {
    // A malformed historical key must not be trusted. Continue by resolving a
    // configured current slot, rather than grouping by a human-facing label.
  }
  const local = instantParts(session.startAt, timezone);
  const duration = booking.serviceSnapshot?.duration ?? service.duration;
  return serviceSlotsForDate(service.id, service.availability, local.date, duration, timezone)
    .find((slot) => slot.startTime === local.time)?.key ?? null;
}

function groupPayment(bookings: ScheduledSessionItem[]): GroupPaymentSummary {
  const paidCount = bookings.filter((item) => item.paymentStatus === "Fully Paid").length;
  const unpaidCount = bookings.length - paidCount;
  if (paidCount === bookings.length) return { paidCount, unpaidCount, label: "All paid" };
  if (paidCount === 0) return { paidCount, unpaidCount, label: `${unpaidCount} unpaid` };
  return { paidCount, unpaidCount, label: `${paidCount} paid · ${unpaidCount} unpaid` };
}

function resolvedCapacity(service: Service, key: string, session: BookingSession, bookings: ScheduledSessionItem[], timezone: string) {
  const local = instantParts(session.startAt, timezone);
  const duration = bookings[0]?.serviceSnapshot?.duration ?? service.duration;
  const slot = serviceSlotsForDate(service.id, service.availability, local.date, duration, timezone).find((item) => item.key === key);
  if (!slot) return { booked: bookings.length, total: null, reserved: 0, available: null };
  const availability = calculateServiceSlotAvailability(slot, bookings.length);
  return {
    booked: availability.confirmedBookings,
    total: availability.capacity,
    reserved: availability.manualBlocked,
    available: availability.remaining,
  };
}

/**
 * Builds the Dashboard's operational view of scheduled work. A group-capacity
 * occurrence is grouped only when a Booking carries the persisted capacity slot
 * key created during public acceptance; unknown legacy sessions remain separate
 * rather than being guessed from display dates or labels.
 */
export function buildUpcomingJobs({
  bookings,
  services,
  timezone,
  now = new Date(),
  limit = 6,
}: {
  bookings: UpcomingBooking[];
  services: Service[];
  timezone: string;
  now?: Date;
  limit?: number;
}): UpcomingJob[] {
  const servicesById = new Map(services.map((service) => [service.id, service]));
  const individual: IndividualUpcomingJob[] = [];
  const grouped = new Map<string, ScheduledSessionItem[]>();

  for (const booking of bookings) {
    if (booking.bookingStatus === "Cancelled") continue;
    const service = servicesById.get(booking.serviceId);
    for (const [sessionIndex, session] of booking.sessions.entries()) {
      if (Date.parse(session.startAt) <= now.getTime()) continue;
      const item: ScheduledSessionItem = { ...booking, session };
      const slotKey = service?.availability?.capacityMode === "Multiple bookings"
        ? stableSlotKeyFor(booking, session, sessionIndex, service, timezone)
        : null;
      if (!slotKey) {
        individual.push({ kind: "individual", item, startAt: session.startAt });
        continue;
      }
      const current = grouped.get(slotKey) ?? [];
      current.push(item);
      grouped.set(slotKey, current);
    }
  }

  const groupJobs: GroupUpcomingJob[] = [];
  for (const [key, groupedBookings] of grouped) {
    const first = [...groupedBookings].sort((left, right) => left.session.startAt.localeCompare(right.session.startAt))[0];
    const service = servicesById.get(first.serviceId);
    if (!service) {
      individual.push(...groupedBookings.map((item) => ({ kind: "individual" as const, item, startAt: item.session.startAt })));
      continue;
    }
    const endAt = groupedBookings.reduce((latest, item) => item.session.endAt > latest ? item.session.endAt : latest, first.session.endAt);
    groupJobs.push({
      kind: "group",
      key,
      serviceId: first.serviceId,
      serviceName: first.serviceName,
      session: { ...first.session, endAt },
      bookings: groupedBookings.sort((left, right) => left.customerName.localeCompare(right.customerName)),
      payment: groupPayment(groupedBookings),
      capacity: resolvedCapacity(service, key, first.session, groupedBookings, timezone),
      participants: groupedBookings.map((item) => item.customerName),
      startAt: first.session.startAt,
    });
  }

  return [...individual, ...groupJobs]
    .sort((left, right) => left.startAt.localeCompare(right.startAt))
    .slice(0, limit);
}
