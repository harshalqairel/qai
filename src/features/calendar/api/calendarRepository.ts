import { CalendarView } from "../types";

export interface CalendarRepository {
  getDefaultView(): CalendarView;
  getAvailableViews(): Array<{ id: CalendarView; label: string }>;
}

export const calendarRepository: CalendarRepository = {
  getDefaultView() {
    return "month";
  },
  getAvailableViews() {
    return [
      { id: "month", label: "Month" },
      { id: "week", label: "Week" },
      { id: "day", label: "Day" },
      { id: "agenda", label: "Agenda" },
    ];
  },
};
