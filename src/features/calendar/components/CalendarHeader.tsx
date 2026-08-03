import { Button } from "@/components/ui/button";
import type { CalendarView } from "../types";

type CalendarHeaderProps = {
  view: CalendarView;
  activeDate: Date;
  onViewChange: (view: CalendarView) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
};

function formatHeaderLabel(date: Date, view: CalendarView) {
  if (view === "month") {
    return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
  }
  if (view === "week") {
    const weekStart = new Date(date);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const startLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(weekStart);
    const endLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(weekEnd);
    return `${startLabel} – ${endLabel}`;
  }
  if (view === "agenda") {
    return "All Bookings";
  }
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(date);
}

export default function CalendarHeader({
  view,
  activeDate,
  onViewChange,
  onPrevious,
  onNext,
  onToday,
}: CalendarHeaderProps) {
  const headerLabel = formatHeaderLabel(activeDate, view);

  return (
    <div className="flex flex-col gap-4 rounded-3xl bg-white p-4 shadow-sm sm:p-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        {/* Mobile: show "Agenda" label; tablet+: show date label */}
        <div className="block text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 md:hidden">Agenda</div>
        <div className="hidden text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 md:block">Calendar</div>
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl lg:text-3xl">{headerLabel}</h1>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Prev / Today / Next — hidden on phones (agenda is always all bookings) */}
        <div className="hidden gap-2 md:flex">
          <Button variant="outline" size="sm" onClick={onPrevious}>Previous</Button>
          <Button variant="outline" size="sm" onClick={onToday}>Today</Button>
          <Button variant="outline" size="sm" onClick={onNext}>Next</Button>
        </div>

        {/* View switcher */}
        {/* Desktop (lg+): Month / Week / Day */}
        <div className="hidden gap-2 lg:flex">
          {(["month", "week", "day"] as const).map((v) => (
            <Button key={v} variant={view === v ? "default" : "outline"} size="sm" onClick={() => onViewChange(v)}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </Button>
          ))}
        </div>

        {/* Tablet (md–lg): Month / Week only */}
        <div className="hidden gap-2 md:flex lg:hidden">
          {(["month", "week"] as const).map((v) => (
            <Button key={v} variant={view === v ? "default" : "outline"} size="sm" onClick={() => onViewChange(v)}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
