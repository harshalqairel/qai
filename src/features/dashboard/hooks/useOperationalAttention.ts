"use client";

import { useEffect, useMemo, useState } from "react";

import { useBookings } from "@/features/booking/hooks/useBookings";
import type { Booking } from "@/features/booking/types";
import { instantParts } from "@/features/booking/utils/bookingSessions";
import { usePayments } from "@/features/payment/hooks/usePayments";
import type { Payment } from "@/features/payment/types";
import { summarizeBookingPayments } from "@/features/payment/utils/paymentCalculations";
import { partitionPaymentsByBookingIntegrity } from "@/features/payment/utils/paymentIntegrity";
import { validationClient, type PublicRequest } from "@/features/qai-page/validation";
import { isPaymentReminderEligible } from "@/features/reminder/reminderTransport";

export function isPendingPublicRequest(request: PublicRequest): boolean {
  return request.status === "Pending" || (request.type === "Instant booking" && !request.bookingId);
}

export function buildOperationalAttention(
  bookings: Booking[],
  payments: Payment[],
  todayKey: string,
  pendingRequests: PublicRequest[],
) {
  const { validPayments } = partitionPaymentsByBookingIntegrity(payments, bookings);
  const summaries = summarizeBookingPayments(bookings, validPayments);
  const overdueBookings = bookings.filter((booking) => {
    const remainingAmount = summaries[booking.id]?.remainingAmount ?? 0;
    return isPaymentReminderEligible({ bookingStatus: booking.bookingStatus, remainingAmount })
      && Boolean(booking.fullPaymentDueDate)
      && booking.fullPaymentDueDate < todayKey;
  });
  const overdueAmount = overdueBookings.reduce((total, booking) => total + (summaries[booking.id]?.remainingAmount ?? 0), 0);

  return {
    overdueCount: overdueBookings.length,
    overdueAmount,
    requestCount: pendingRequests.length,
    attentionCount: overdueBookings.length + pendingRequests.length,
  };
}

export default function useOperationalAttention() {
  const bookingData = useBookings();
  const paymentData = usePayments();
  const [pendingRequests, setPendingRequests] = useState<PublicRequest[]>([]);

  useEffect(() => {
    let active = true;
    async function loadRequests() {
      try {
        const store = await validationClient.owner();
        if (active) {
          setPendingRequests(store.requests.filter(isPendingPublicRequest).sort((left, right) => right.submittedAt - left.submittedAt));
        }
      } catch {
        if (active) setPendingRequests([]);
      }
    }
    void loadRequests();
    const timer = window.setInterval(() => { void loadRequests(); }, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const todayKey = useMemo(
    () => instantParts(new Date().toISOString(), bookingData.timezone).date,
    [bookingData.timezone],
  );
  const summary = useMemo(
    () => buildOperationalAttention(bookingData.bookings, paymentData.payments, todayKey, pendingRequests),
    [bookingData.bookings, paymentData.payments, pendingRequests, todayKey],
  );

  return {
    ...summary,
    pendingRequests,
    isLoading: bookingData.isLoading || paymentData.isLoading,
  };
}
