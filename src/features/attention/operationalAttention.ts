import type { Booking } from "@/features/booking/types";
import { bookingClientTotal } from "@/features/booking/domain/bookingFinancials";
import { instantParts } from "@/features/booking/utils/bookingSessions";
import type { Customer } from "@/features/customer/types";
import type { Payment } from "@/features/payment/types";
import { summarizeBookingPayments } from "@/features/payment/utils/paymentCalculations";
import { partitionPaymentsByBookingIntegrity } from "@/features/payment/utils/paymentIntegrity";
import type { PublicRequest } from "@/features/qai-page/validation";
import type { Service } from "@/features/service/types";
import { bookingHref, requestsHref } from "@/lib/coreRecordNavigation";

export type AttentionType = "overdue-payment" | "payment-due-soon" | "booking-tomorrow" | "pending-request" | "request-recovery";
export type AttentionPriority = "critical" | "high" | "normal";
export type AttentionAction = "message-client" | "record-payment" | "open-booking" | "review-request";

export type OperationalAttentionItem = {
  id: string;
  type: AttentionType;
  priority: AttentionPriority;
  title: string;
  explanation: string;
  amount: number | null;
  date: string | null;
  targetHref: string;
  actions: AttentionAction[];
  bookingId: string | null;
  customerId: string | null;
  requestId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  serviceName: string;
  bookingDate: string;
  dueDate: string;
  bookingValue: number;
  totalPaid: number;
  remainingAmount: number;
};

const PRIORITY_ORDER: Record<AttentionPriority, number> = { critical: 0, high: 1, normal: 2 };
const TYPE_ORDER: Record<AttentionType, number> = {
  "request-recovery": 0,
  "overdue-payment": 1,
  "payment-due-soon": 2,
  "pending-request": 3,
  "booking-tomorrow": 4,
};

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function earliestSessionDate(booking: Booking, timezone: string): string {
  const session = [...booking.sessions].sort((left, right) => left.startAt.localeCompare(right.startAt))[0];
  return session ? instantParts(session.startAt, timezone).date : "";
}

function bookingContext(booking: Booking, customers: Customer[], services: Service[], timezone: string) {
  const customer = customers.find((item) => item.id === booking.customerId);
  const service = services.find((item) => item.id === booking.serviceId);
  return {
    customerName: customer?.name ?? "Client",
    customerPhone: customer?.phone ?? "",
    customerEmail: customer?.email ?? "",
    serviceName: booking.serviceSnapshot?.serviceName || service?.name || "Service",
    bookingDate: earliestSessionDate(booking, timezone),
  };
}

export function isPendingPublicRequest(request: PublicRequest): boolean {
  return request.status === "Pending" || (request.status === "Accepted" && !request.bookingId);
}

export function buildOperationalAttentionItems(input: {
  bookings: Booking[];
  payments: Payment[];
  customers: Customer[];
  services: Service[];
  requests: PublicRequest[];
  todayKey: string;
  timezone: string;
  dueSoonDays?: number;
}): OperationalAttentionItem[] {
  const { validPayments } = partitionPaymentsByBookingIntegrity(input.payments, input.bookings);
  const summaries = summarizeBookingPayments(input.bookings, validPayments);
  const tomorrowKey = addDays(input.todayKey, 1);
  const dueSoonEnd = addDays(input.todayKey, input.dueSoonDays ?? 3);
  const items: OperationalAttentionItem[] = [];

  for (const booking of input.bookings) {
    if (booking.bookingStatus === "Cancelled") continue;
    const summary = summaries[booking.id];
    const remainingAmount = summary?.remainingAmount ?? 0;
    const totalPaid = summary?.totalPaid ?? 0;
    const context = bookingContext(booking, input.customers, input.services, input.timezone);
    const common = {
      bookingId: booking.id,
      customerId: booking.customerId,
      requestId: null,
      ...context,
      dueDate: booking.fullPaymentDueDate,
      bookingValue: bookingClientTotal(booking),
      totalPaid,
      remainingAmount,
    };

    if (remainingAmount > 0 && booking.fullPaymentDueDate && booking.fullPaymentDueDate < input.todayKey) {
      items.push({
        ...common,
        id: `overdue-payment:${booking.id}`,
        type: "overdue-payment",
        priority: "critical",
        title: `${context.customerName} has an overdue payment`,
        explanation: `${context.serviceName} · payment was due ${booking.fullPaymentDueDate}`,
        amount: remainingAmount,
        date: booking.fullPaymentDueDate,
        targetHref: bookingHref(booking.id),
        actions: ["message-client", "record-payment", "open-booking"],
      });
    } else if (remainingAmount > 0 && booking.fullPaymentDueDate >= input.todayKey && booking.fullPaymentDueDate <= dueSoonEnd) {
      items.push({
        ...common,
        id: `payment-due-soon:${booking.id}`,
        type: "payment-due-soon",
        priority: "high",
        title: `${context.customerName}'s payment is due soon`,
        explanation: `${context.serviceName} · due ${booking.fullPaymentDueDate}`,
        amount: remainingAmount,
        date: booking.fullPaymentDueDate,
        targetHref: bookingHref(booking.id),
        actions: ["message-client", "record-payment", "open-booking"],
      });
    }

    const tomorrowSessions = booking.bookingStatus === "Scheduled" ? booking.sessions
      .filter((session) => instantParts(session.startAt, input.timezone).date === tomorrowKey)
      .sort((left, right) => left.startAt.localeCompare(right.startAt)) : [];
    if (tomorrowSessions.length > 0) {
      const tomorrowTime = instantParts(tomorrowSessions[0].startAt, input.timezone).time;
      items.push({
        ...common,
        id: `booking-tomorrow:${booking.id}`,
        type: "booking-tomorrow",
        priority: "normal",
        title: `${context.customerName}'s booking is tomorrow`,
        explanation: `${context.serviceName} · ${tomorrowTime}`,
        amount: null,
        date: tomorrowKey,
        bookingDate: `${tomorrowKey} · ${tomorrowTime}`,
        targetHref: bookingHref(booking.id),
        actions: ["message-client", "open-booking"],
      });
    }
  }

  for (const request of input.requests.filter(isPendingPublicRequest)) {
    const recovery = request.status === "Accepted" && !request.bookingId;
    const recoveredBooking = recovery
      ? input.bookings.find((booking) => booking.capacitySourceRequestId === request.id)
      : undefined;
    const recoveredSummary = recoveredBooking ? summaries[recoveredBooking.id] : undefined;
    const requestValue = recoveredBooking ? bookingClientTotal(recoveredBooking) : request.serviceSnapshot?.price ?? 0;
    items.push({
      id: `${recovery ? "request-recovery" : "pending-request"}:${request.id}`,
      type: recovery ? "request-recovery" : "pending-request",
      priority: recovery ? "critical" : "high",
      title: recovery ? `Finish ${request.clientName}'s booking setup` : `Review ${request.clientName}'s booking`,
      explanation: recovery
        ? recoveredBooking
          ? "The Booking exists, but its Qai Space request still needs to be linked."
          : "This accepted request has no linked Booking yet. Review it to safely complete setup."
        : `${request.serviceName} · submitted from Qai Space`,
      amount: null,
      date: new Date(request.submittedAt).toISOString(),
      targetHref: requestsHref(request.id),
      actions: ["review-request"],
      bookingId: recoveredBooking?.id ?? null,
      customerId: request.clientId ?? recoveredBooking?.customerId ?? null,
      requestId: request.id,
      customerName: request.clientName,
      customerPhone: request.whatsapp,
      customerEmail: request.email,
      serviceName: request.serviceName,
      bookingDate: request.schedules[0]?.date ?? "",
      dueDate: "",
      bookingValue: requestValue,
      totalPaid: recoveredSummary?.totalPaid ?? 0,
      remainingAmount: recoveredSummary?.remainingAmount ?? requestValue,
    });
  }

  return items.sort((left, right) =>
    PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority]
    || (left.date ?? "").localeCompare(right.date ?? "")
    || TYPE_ORDER[left.type] - TYPE_ORDER[right.type]
    || left.id.localeCompare(right.id));
}
