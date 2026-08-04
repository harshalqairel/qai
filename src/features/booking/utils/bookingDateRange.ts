type DateParts = {
  year: number;
  month: number;
  day: number;
};

type TimeParts = {
  hours: number;
  minutes: number;
};

export type BookingDateRangeInput = {
  bookingDate: string;
  startTime: string;
  endTime: string;
};

export type BookingDateRange = {
  start: Date;
  end: Date;
  endsNextDay: boolean;
  durationMinutes: number;
};

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseBookingDateParts(value: string): DateParts | null {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

export function parseBookingTimeParts(value: string): TimeParts | null {
  const match = TIME_PATTERN.exec(value);
  if (!match) return null;
  return { hours: Number(match[1]), minutes: Number(match[2]) };
}

function buildLocalDateTime(date: DateParts, time: TimeParts): Date {
  return new Date(date.year, date.month - 1, date.day, time.hours, time.minutes, 0, 0);
}

export function doesBookingEndNextDay(startTime: string, endTime: string): boolean | null {
  const start = parseBookingTimeParts(startTime);
  const end = parseBookingTimeParts(endTime);
  if (!start || !end) return null;

  const startMinutes = start.hours * 60 + start.minutes;
  const endMinutes = end.hours * 60 + end.minutes;
  return endMinutes <= startMinutes;
}

export function getBookingDateRange(input: BookingDateRangeInput): BookingDateRange | null {
  const date = parseBookingDateParts(input.bookingDate);
  const startTime = parseBookingTimeParts(input.startTime);
  const endTime = parseBookingTimeParts(input.endTime);
  if (!date || !startTime || !endTime) return null;

  const start = buildLocalDateTime(date, startTime);
  const end = buildLocalDateTime(date, endTime);
  const endsNextDay = doesBookingEndNextDay(input.startTime, input.endTime);
  if (endsNextDay === null) return null;
  if (endsNextDay) {
    end.setDate(end.getDate() + 1);
  }

  const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
  return { start, end, endsNextDay, durationMinutes };
}

export function formatBookingTimeRange(
  bookingDate: string | null | undefined,
  startTime: string | null | undefined,
  endTime: string | null | undefined,
): string {
  const start = startTime?.trim();
  const end = endTime?.trim();

  if (!start) return "Time not set";
  if (!end) return start;
  if (!bookingDate) return `${start}\u2013${end}`;

  const range = getBookingDateRange({ bookingDate, startTime: start, endTime: end });
  if (!range) return `${start}\u2013${end}`;

  return range.endsNextDay ? `${start}\u2013${end} \u00b7 Next day` : `${start}\u2013${end}`;
}

export function compareByBookingStartDateTime(
  left: Pick<BookingDateRangeInput, "bookingDate" | "startTime">,
  right: Pick<BookingDateRangeInput, "bookingDate" | "startTime">,
): number {
  const leftDate = parseBookingDateParts(left.bookingDate);
  const rightDate = parseBookingDateParts(right.bookingDate);
  const leftTime = parseBookingTimeParts(left.startTime);
  const rightTime = parseBookingTimeParts(right.startTime);

  if (!leftDate || !leftTime || !rightDate || !rightTime) {
    if (left.bookingDate !== right.bookingDate) {
      return left.bookingDate.localeCompare(right.bookingDate);
    }
    return left.startTime.localeCompare(right.startTime);
  }

  const leftStart = buildLocalDateTime(leftDate, leftTime).getTime();
  const rightStart = buildLocalDateTime(rightDate, rightTime).getTime();
  return leftStart - rightStart;
}

export function bookingOverlapsWindow(
  booking: BookingDateRangeInput,
  windowStart: Date,
  windowEnd: Date,
): boolean {
  const range = getBookingDateRange(booking);
  if (!range) return false;
  return range.start < windowEnd && range.end > windowStart;
}

export function getBookingCoveredDateKeys(booking: BookingDateRangeInput): string[] {
  const range = getBookingDateRange(booking);
  if (!range) return [booking.bookingDate];

  const keys: string[] = [];
  const cursor = new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate());
  while (cursor < range.end) {
    keys.push(formatDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}
