export type BookingNavigationAction = "payment";

export function bookingHref(bookingId: string, action?: BookingNavigationAction): string {
  const params = new URLSearchParams({ booking: bookingId });
  if (action) params.set("action", action);
  return `/bookings?${params.toString()}`;
}

export function requestsHref(requestId?: string): string {
  const params = new URLSearchParams({ tab: "Requests" });
  if (requestId) params.set("request", requestId);
  return `/space?${params.toString()}`;
}
