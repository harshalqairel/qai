"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { paymentRepository } from "../api/paymentRepository";
import { CreatePaymentInput, Payment, UpdatePaymentInput } from "../types";
import { emitDataRefresh, subscribeToDataRefresh } from "@/lib/dataRefresh";
import { isCloudModeEnabled } from "@/lib/supabase/config";
import { cloudPaymentRepository } from "@/lib/supabase/cloudRepositories";

export function usePayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const retry = useCallback(async () => {
    setIsLoading(true);
    try {
      const loaded = isCloudModeEnabled()
        ? await cloudPaymentRepository.getAll()
        : paymentRepository.getAll();
      setPayments(loaded);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const refresh = () => { void retry(); };
    const timeoutId = window.setTimeout(refresh, 0);
    const unsubscribe = subscribeToDataRefresh(refresh);
    return () => {
      window.clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [retry]);

  const createPaymentOrThrow = useCallback(async (input: CreatePaymentInput): Promise<boolean> => {
    const payment: Payment = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      ...input,
    };

    if (isCloudModeEnabled()) await cloudPaymentRepository.create(payment);
    else paymentRepository.create(payment);
    setPayments((prev) => [...prev, payment]);
    emitDataRefresh();
    return true;
  }, []);

  const createPayment = useCallback(async (input: CreatePaymentInput): Promise<boolean> => {
    try { return await createPaymentOrThrow(input); }
    catch { return false; }
  }, [createPaymentOrThrow]);

  const updatePaymentOrThrow = useCallback(async (input: UpdatePaymentInput): Promise<boolean> => {
    const current = payments.find((payment) => payment.id === input.id);
    if (!current) throw new Error("PAYMENT_NOT_FOUND");
    const updated: Payment = { ...current, ...input };

    if (isCloudModeEnabled()) await cloudPaymentRepository.update(updated);
    else paymentRepository.update(updated);
    setPayments((prev) =>
      prev.map((payment) => (payment.id === updated.id ? updated : payment)),
    );
    emitDataRefresh();
    return true;
  }, [payments]);

  const updatePayment = useCallback(async (input: UpdatePaymentInput): Promise<boolean> => {
    try { return await updatePaymentOrThrow(input); }
    catch { return false; }
  }, [updatePaymentOrThrow]);

  const deletePayment = useCallback(async (id: string): Promise<boolean> => {
    try {
      if (isCloudModeEnabled()) await cloudPaymentRepository.delete(id);
      else paymentRepository.delete(id);
      setPayments((prev) => prev.filter((payment) => payment.id !== id));
      emitDataRefresh();
      return true;
    } catch {
      return false;
    }
  }, []);

  const paymentsByBookingId = useMemo(() => {
    const map = new Map<string, Payment[]>();
    for (const payment of payments) {
      const list = map.get(payment.bookingId) ?? [];
      list.push(payment);
      map.set(payment.bookingId, list);
    }
    return map;
  }, [payments]);

  return {
    payments,
    paymentsByBookingId,
    createPayment,
    createPaymentOrThrow,
    updatePayment,
    updatePaymentOrThrow,
    deletePayment,
    isLoading,
    loadError,
    retry,
  };
}
