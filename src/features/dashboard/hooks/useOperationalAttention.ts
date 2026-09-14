"use client";

import { useEffect, useMemo, useState } from "react";
import { buildOperationalAttentionItems, isPendingPublicRequest } from "@/features/attention/operationalAttention";
import { useBookings } from "@/features/booking/hooks/useBookings";
import type { Booking } from "@/features/booking/types";
import { instantParts } from "@/features/booking/utils/bookingSessions";
import { useCustomers } from "@/features/customer/hooks/useCustomers";
import { usePayments } from "@/features/payment/hooks/usePayments";
import type { Payment } from "@/features/payment/types";
import { validationClient, type PublicRequest } from "@/features/qai-page/validation";
import { useServices } from "@/features/service/hooks/useServices";

export { isPendingPublicRequest } from "@/features/attention/operationalAttention";

export function buildOperationalAttention(
  bookings: Booking[],
  payments: Payment[],
  todayKey: string,
  pendingRequests: PublicRequest[],
) {
  const items = buildOperationalAttentionItems({
    bookings,
    payments,
    customers: [],
    services: [],
    requests: pendingRequests,
    todayKey,
    timezone: "Asia/Jakarta",
  });
  const overdue = items.filter((item) => item.type === "overdue-payment");
  const requests = items.filter((item) => item.type === "pending-request" || item.type === "request-recovery");
  return {
    overdueCount: overdue.length,
    overdueAmount: overdue.reduce((total, item) => total + (item.amount ?? 0), 0),
    requestCount: requests.length,
    attentionCount: items.length,
  };
}

export default function useOperationalAttention() {
  const bookingData = useBookings();
  const paymentData = usePayments();
  const customerData = useCustomers();
  const serviceData = useServices();
  const [pendingRequests, setPendingRequests] = useState<PublicRequest[]>([]);

  useEffect(() => {
    let active = true;
    async function loadRequests() {
      try {
        const store = await validationClient.owner();
        if (active) setPendingRequests(store.requests.filter(isPendingPublicRequest).sort((left, right) => right.submittedAt - left.submittedAt));
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
  const items = useMemo(
    () => buildOperationalAttentionItems({
      bookings: bookingData.bookings,
      payments: paymentData.payments,
      customers: customerData.customers,
      services: serviceData.services,
      requests: pendingRequests,
      todayKey,
      timezone: bookingData.timezone,
    }),
    [bookingData.bookings, paymentData.payments, customerData.customers, serviceData.services, pendingRequests, todayKey, bookingData.timezone],
  );
  const overdue = items.filter((item) => item.type === "overdue-payment");

  return {
    items,
    overdueCount: overdue.length,
    overdueAmount: overdue.reduce((total, item) => total + (item.amount ?? 0), 0),
    requestCount: items.filter((item) => item.type === "pending-request" || item.type === "request-recovery").length,
    attentionCount: items.length,
    pendingRequests,
    isLoading: bookingData.isLoading || paymentData.isLoading || customerData.isLoading || serviceData.isLoading,
  };
}
