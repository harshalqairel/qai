import type { BookingSessionInput } from "@/features/booking/types";

/**
 * Review-only shape for a future WhatsApp extraction workflow. Extracted
 * schedules are never persisted until the user confirms the draft.
 */
export interface WhatsAppBookingExtractionDraft {
  customerName?: string;
  serviceName?: string;
  notes?: string;
  sessions: BookingSessionInput[];
  confirmationStatus: "requires_confirmation";
}
