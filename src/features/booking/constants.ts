export const BOOKING_STORAGE_KEY = "qai:bookings";
export const BOOKING_STORAGE_VERSION = 2;
export const MAX_BOOKING_SESSIONS = 50;
export const BOOKING_CREATION_RECEIPT_STORAGE_KEY = "qai:booking-creation-receipts";
export const BOOKING_CREATION_RECEIPT_STORAGE_VERSION = 1;

export const BOOKING_STATUSES = [
  "Scheduled",
  "Completed",
  "Cancelled",
] as const;
