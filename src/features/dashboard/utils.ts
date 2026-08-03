export function formatDashboardDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

export function formatBookingTime(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
): string {
  const start = startTime?.trim();
  const end = endTime?.trim();

  if (!start) return "Time not set";
  if (!end) return start;
  return `${start}\u2013${end}`;
}
