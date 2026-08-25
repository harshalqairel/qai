import type { Invoice } from "@/features/invoice/invoice";
import { sessionToFormValues } from "@/features/booking/utils/bookingSessions";
import type { Booking, BookingAdditionalChargeInput, UpdateBookingInput } from "@/features/booking/types";
import { normalizeServiceAvailability } from "@/features/service/domain/serviceAvailability";
import { defaultServiceVariant, snapshotServiceSelection } from "@/features/service/domain/serviceVariants";
import type { Service } from "@/features/service/types";

export type BulkServiceChangeBlockReason = "capacity-session" | "destination-availability" | "issued-invoice" | "same-service";

export type BulkServiceChangeEligibility = {
  eligible: boolean;
  reason: BulkServiceChangeBlockReason | null;
  message: string | null;
};

export function serviceUsesManagedAvailability(service: Service): boolean {
  const availability = normalizeServiceAvailability(service.availability);
  return availability.mode !== "Flexible" || availability.capacityMode === "Multiple bookings";
}

export function recommendedServiceChangePriceMode(input: {
  currentPrice: number;
  originalDefaultPrice: number;
  hasPayments: boolean;
  hasIssuedInvoice: boolean;
}): "keep-current" | "use-new-default" {
  return !input.hasPayments
    && !input.hasIssuedInvoice
    && input.currentPrice === input.originalDefaultPrice
    ? "use-new-default"
    : "keep-current";
}

export function bulkServiceChangeEligibility(
  booking: Pick<Booking, "id" | "serviceId" | "capacitySlotKeys">,
  nextService: Service,
  invoices: readonly Pick<Invoice, "bookingId" | "lifecycle">[],
): BulkServiceChangeEligibility {
  if (booking.serviceId === nextService.id) {
    return { eligible: false, reason: "same-service", message: "Already uses this service." };
  }
  if ((booking.capacitySlotKeys ?? []).length > 0) {
    return { eligible: false, reason: "capacity-session", message: "Belongs to a capacity-managed session and needs individual review." };
  }
  if (serviceUsesManagedAvailability(nextService)) {
    return { eligible: false, reason: "destination-availability", message: "The new service uses managed booking times and needs individual review." };
  }
  if (invoices.some((invoice) => invoice.bookingId === booking.id && invoice.lifecycle === "Issued")) {
    return { eligible: false, reason: "issued-invoice", message: "Has an issued invoice and needs individual review." };
  }
  return { eligible: true, reason: null, message: null };
}

function additionalChargeInputs(booking: Booking): BookingAdditionalChargeInput[] {
  return (booking.additionalCharges ?? []).map((charge) => ({
    id: charge.id,
    sessionId: charge.sessionId,
    categoryId: charge.categoryId,
    categoryName: charge.categoryName,
    description: charge.description,
    amount: charge.amount,
  }));
}

export function buildBulkServiceChangeInput(booking: Booking, nextService: Service, timezone: string): UpdateBookingInput {
  return {
    id: booking.id,
    customerId: booking.customerId,
    serviceId: nextService.id,
    serviceSnapshot: snapshotServiceSelection(nextService, defaultServiceVariant(nextService)),
    sessions: booking.sessions.map((session) => sessionToFormValues(session, timezone)),
    servicePrice: booking.servicePrice,
    additionalCharges: additionalChargeInputs(booking),
    questionnaireResponses: booking.questionnaireResponses ?? [],
    capacitySourceRequestId: null,
    capacitySlotKeys: [],
    bookingStatus: booking.bookingStatus,
    fullPaymentDueDate: booking.fullPaymentDueDate,
    notes: booking.notes,
  };
}
