import type {
  Booking,
  BookingSession,
  BookingSessionInput,
} from "@/features/booking/types";

export function getDeviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jakarta";
}

function timeZoneOffsetMilliseconds(instant: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const representedAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
  return representedAsUtc - instant.getTime();
}

export function zonedDateTimeToIso(date: string, time: string, timezone: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wallTimeAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let candidate = new Date(wallTimeAsUtc);
  for (let iteration = 0; iteration < 2; iteration += 1) {
    candidate = new Date(wallTimeAsUtc - timeZoneOffsetMilliseconds(candidate, timezone));
  }
  return candidate.toISOString();
}

export function sessionInputToInstants(
  input: BookingSessionInput,
  timezone: string,
): { startAt: string; endAt: string } {
  const startAt = zonedDateTimeToIso(input.date, input.startTime, timezone);
  let endAt = zonedDateTimeToIso(input.date, input.endTime, timezone);
  if (Date.parse(endAt) <= Date.parse(startAt)) {
    const nextDate = new Date(`${input.date}T00:00:00.000Z`);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    endAt = zonedDateTimeToIso(nextDate.toISOString().slice(0, 10), input.endTime, timezone);
  }
  return { startAt, endAt };
}

export function instantParts(instant: string, timezone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instant));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
}

export function sessionToFormValues(
  session: BookingSession,
  timezone: string,
): BookingSessionInput {
  const start = instantParts(session.startAt, timezone);
  const end = instantParts(session.endAt, timezone);
  return {
    id: session.id,
    label: session.label,
    date: start.date,
    startTime: start.time,
    endTime: end.time,
    location: session.location,
    notes: session.notes,
  };
}

export function buildBookingSessions(
  bookingId: string,
  inputs: BookingSessionInput[],
  timezone: string,
  existing: BookingSession[] = [],
  now = Date.now(),
): BookingSession[] {
  const existingById = new Map(existing.map((session) => [session.id, session]));
  return inputs.map((input, index) => {
    const prior = input.id ? existingById.get(input.id) : undefined;
    const instants = sessionInputToInstants(input, timezone);
    return {
      id: prior?.id ?? (input.id?.trim() || crypto.randomUUID()),
      bookingId,
      sequence: index + 1,
      label: input.label.trim(),
      ...instants,
      location: input.location.trim(),
      notes: input.notes.trim(),
      createdAt: prior?.createdAt ?? now,
      updatedAt: now,
    };
  });
}

export function sortBookingSessions(sessions: readonly BookingSession[]): BookingSession[] {
  return [...sessions].sort(
    (left, right) => left.sequence - right.sequence || left.startAt.localeCompare(right.startAt),
  );
}

export function firstBookingSession(booking: Pick<Booking, "sessions">): BookingSession {
  return sortBookingSessions(booking.sessions)[0];
}

export function compareBookingsByFirstSession(
  left: Pick<Booking, "sessions">,
  right: Pick<Booking, "sessions">,
): number {
  return firstBookingSession(left).startAt.localeCompare(firstBookingSession(right).startAt);
}

export function nextBookingSession(
  booking: Pick<Booking, "sessions">,
  now = new Date(),
): BookingSession | null {
  return [...booking.sessions]
    .filter((session) => Date.parse(session.endAt) >= now.getTime())
    .sort((left, right) => left.startAt.localeCompare(right.startAt))[0] ?? null;
}

export function finalBookingSession(booking: Pick<Booking, "sessions">): BookingSession {
  return [...booking.sessions].sort((left, right) => right.endAt.localeCompare(left.endAt))[0];
}

export function shouldAutoCompleteBooking(
  booking: Pick<Booking, "bookingStatus" | "sessions">,
  now: Date,
  timezone: string,
): boolean {
  if (booking.bookingStatus !== "Scheduled") return false;
  const today = instantParts(now.toISOString(), timezone).date;
  const finalSessionDate = instantParts(finalBookingSession(booking).endAt, timezone).date;
  return today > finalSessionDate;
}

export function formatSessionDate(
  session: BookingSession,
  timezone: string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" },
): string {
  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: timezone }).format(new Date(session.startAt));
}

export function formatSessionTime(session: BookingSession, timezone: string): string {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return `${formatter.format(new Date(session.startAt))}–${formatter.format(new Date(session.endAt))}`;
}
