import type { CalendarBooking, CalendarView } from "../types";

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(date: Date, offset: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + offset);
  return next;
}

function startOfWeek(date: Date) {
  const result = new Date(date);
  result.setDate(result.getDate() - result.getDay());
  return result;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function statusClasses(status: string) {
  if (status === "Scheduled") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (status === "Completed") return "bg-sky-100 text-sky-700 border-sky-200";
  return "bg-red-100 text-red-700 border-red-200";
}

type CalendarViewProps = {
  view: CalendarView;
  activeDate: Date;
  bookings: CalendarBooking[];
  onBookingClick: (booking: CalendarBooking) => void;
  onDateClick: (date: string) => void;
};

// ── Agenda / list view (chronological) ─────────────────────────────────────
function AgendaView({ bookings, onBookingClick, onDateClick }: Pick<CalendarViewProps, "bookings" | "onBookingClick" | "onDateClick">) {
  const sorted = [...bookings].sort((a, b) => {
    if (a.bookingDate !== b.bookingDate) return a.bookingDate.localeCompare(b.bookingDate);
    return (a.startTime || "").localeCompare(b.startTime || "");
  });

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-200 p-12 text-center text-sm text-zinc-500">
        No bookings found.
      </div>
    );
  }

  // Group by date
  const groups = new Map<string, CalendarBooking[]>();
  for (const b of sorted) {
    const list = groups.get(b.bookingDate) ?? [];
    list.push(b);
    groups.set(b.bookingDate, list);
  }

  return (
    <div className="space-y-6">
      {Array.from(groups.entries()).map(([dateKey, items]) => {
        const d = new Date(dateKey + "T00:00:00");
        const label = d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });
        return (
          <div key={dateKey}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">{label}</h3>
              <button
                type="button"
                onClick={() => onDateClick(dateKey)}
                className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100"
              >
                + New
              </button>
            </div>
            <div className="space-y-3">
              {items.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => onBookingClick(b)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left shadow-sm transition hover:brightness-95 ${statusClasses(b.bookingStatus)}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-900">{b.customerName} — {b.serviceName}</div>
                      <div className="mt-0.5 text-xs text-zinc-600">
                        {b.startTime ? `${b.startTime}${b.endTime ? ` – ${b.endTime}` : ""}` : ""}
                        {b.location ? ` · ${b.location}` : ""}
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${statusClasses(b.bookingStatus)}`}>{b.bookingStatus}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Month view ──────────────────────────────────────────────────────────────
function MonthView({ activeDate, bookingsByDate, onBookingClick, onDateClick }: {
  activeDate: Date;
  bookingsByDate: Map<string, CalendarBooking[]>;
  onBookingClick: (b: CalendarBooking) => void;
  onDateClick: (d: string) => void;
}) {
  const monthStart = startOfMonth(activeDate);
  const monthStartWeek = startOfWeek(monthStart);
  const gridDays = Array.from({ length: 42 }, (_, i) => addDays(monthStartWeek, i));

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 shadow-sm">
      <div className="grid grid-cols-7 gap-px bg-zinc-200 px-2 py-3 text-center text-xs font-semibold uppercase tracking-[0.15em] text-zinc-600 sm:text-sm">
        {WEEK_DAYS.map((d) => <div key={d} className="py-2">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-px bg-zinc-200 p-2">
        {gridDays.map((day) => {
          const dateKey = toDateKey(day);
          const dayBookings = bookingsByDate.get(dateKey) ?? [];
          const isCurrentMonth = day.getMonth() === activeDate.getMonth();
          return (
            <div
              key={dateKey}
              className={`flex min-h-[80px] flex-col gap-1 rounded-lg border border-zinc-200 bg-white p-2 transition lg:min-h-[120px] lg:gap-2 lg:p-3 ${isCurrentMonth ? "" : "bg-zinc-50 opacity-50"}`}
              onClick={() => onDateClick(dateKey)}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold lg:text-sm">{day.getDate()}</span>
                {dayBookings.length > 0 && (
                  <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 lg:px-2">{dayBookings.length}</span>
                )}
              </div>
              <div className="space-y-1">
                {dayBookings.slice(0, 2).map((booking) => (
                  <button
                    key={booking.id}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onBookingClick(booking); }}
                    className={`w-full rounded-xl border px-2 py-1 text-left text-[10px] shadow-sm transition hover:brightness-95 lg:rounded-2xl lg:text-xs ${statusClasses(booking.bookingStatus)}`}
                  >
                    <div className="truncate font-semibold">{booking.customerName}</div>
                    <div className="hidden truncate text-zinc-600 lg:block">{booking.serviceName}</div>
                    <div className="hidden text-zinc-500 lg:block">{booking.startTime}{booking.endTime ? ` – ${booking.endTime}` : ""}</div>
                  </button>
                ))}
                {dayBookings.length > 2 && (
                  <div className="rounded-xl bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600 lg:rounded-2xl lg:px-3 lg:py-1 lg:text-xs">
                    +{dayBookings.length - 2} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Week view ───────────────────────────────────────────────────────────────
function WeekView({ activeDate, bookingsByDate, onBookingClick, onDateClick }: {
  activeDate: Date;
  bookingsByDate: Map<string, CalendarBooking[]>;
  onBookingClick: (b: CalendarBooking) => void;
  onDateClick: (d: string) => void;
}) {
  const weekStart = startOfWeek(activeDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="grid gap-3 sm:grid-cols-7">
      {days.map((day) => {
        const dateKey = toDateKey(day);
        const dayBookings = bookingsByDate.get(dateKey) ?? [];
        return (
          <div key={dateKey} className="flex flex-col rounded-xl border border-zinc-200 bg-white p-3 shadow-sm sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-slate-900 sm:text-sm">{WEEK_DAYS[day.getDay()]}</p>
                <p className="text-[11px] text-zinc-500">{day.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
              </div>
              <button
                type="button"
                onClick={() => onDateClick(dateKey)}
                className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-semibold text-zinc-700 transition hover:bg-zinc-100 sm:px-3 sm:py-1 sm:text-xs"
              >
                +
              </button>
            </div>
            {dayBookings.length === 0 ? (
              <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-zinc-200 p-3 text-center text-xs text-zinc-400 sm:rounded-3xl sm:p-4 sm:text-sm">
                —
              </div>
            ) : (
              <div className="space-y-2">
                {dayBookings.map((booking) => (
                  <button
                    key={booking.id}
                    type="button"
                    onClick={() => onBookingClick(booking)}
                    className={`w-full rounded-2xl border px-3 py-2 text-left shadow-sm transition hover:brightness-95 ${statusClasses(booking.bookingStatus)}`}
                  >
                    <div className="truncate text-xs font-semibold text-slate-900">{booking.customerName}</div>
                    <div className="truncate text-[11px] text-zinc-600">{booking.serviceName}</div>
                    <div className="mt-0.5 text-[11px] text-zinc-500">{booking.startTime}{booking.endTime ? ` – ${booking.endTime}` : ""}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Day view ────────────────────────────────────────────────────────────────
function DayView({ activeDate, bookingsByDate, onBookingClick, onDateClick }: {
  activeDate: Date;
  bookingsByDate: Map<string, CalendarBooking[]>;
  onBookingClick: (b: CalendarBooking) => void;
  onDateClick: (d: string) => void;
}) {
  const dayKey = toDateKey(activeDate);
  const dayBookings = bookingsByDate.get(dayKey) ?? [];

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Day</p>
          <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
            {new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(activeDate)}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => onDateClick(dayKey)}
          className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-zinc-100"
        >
          + Add booking
        </button>
      </div>
      {dayBookings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 p-12 text-center text-sm text-zinc-500">
          No bookings for this day.
        </div>
      ) : (
        <div className="space-y-3">
          {dayBookings.map((booking) => (
            <button
              key={booking.id}
              type="button"
              onClick={() => onBookingClick(booking)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-left shadow-sm transition hover:border-zinc-300"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-slate-900 sm:text-lg">{booking.customerName} — {booking.serviceName}</h3>
                  <p className="mt-0.5 text-sm text-zinc-700">{booking.startTime}{booking.endTime ? ` – ${booking.endTime}` : ""}</p>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(booking.bookingStatus)}`}>{booking.bookingStatus}</span>
              </div>
              {booking.location && <p className="mt-2 truncate text-sm text-zinc-600">{booking.location}</p>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main export ─────────────────────────────────────────────────────────────
export default function CalendarView({
  view,
  activeDate,
  bookings,
  onBookingClick,
  onDateClick,
}: CalendarViewProps) {
  const bookingsByDate = bookings.reduce((map, booking) => {
    const group = map.get(booking.bookingDate) ?? [];
    group.push(booking);
    map.set(booking.bookingDate, group);
    return map;
  }, new Map<string, CalendarBooking[]>());

  const shared = { bookingsByDate, onBookingClick, onDateClick };

  return (
    <>
      {/* On phones (<md): always show Agenda */}
      <div className="block md:hidden">
        <AgendaView bookings={bookings} onBookingClick={onBookingClick} onDateClick={onDateClick} />
      </div>

      {/* On tablet (md–lg): Month and Week only (no Day) */}
      {/* On desktop (lg+): all three views */}
      <div className="hidden md:block">
        {view === "month" && <MonthView activeDate={activeDate} {...shared} />}
        {view === "week" && <WeekView activeDate={activeDate} {...shared} />}
        {view === "day" && (
          <>
            {/* Day hidden on tablet — fall back to week layout */}
            <div className="hidden lg:block">
              <DayView activeDate={activeDate} {...shared} />
            </div>
            <div className="block lg:hidden">
              <WeekView activeDate={activeDate} {...shared} />
            </div>
          </>
        )}
        {view === "agenda" && <AgendaView bookings={bookings} onBookingClick={onBookingClick} onDateClick={onDateClick} />}
      </div>
    </>
  );
}
