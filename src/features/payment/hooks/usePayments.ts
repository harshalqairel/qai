"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { paymentRepository } from "../api/paymentRepository";
import { CreatePaymentInput, Payment, UpdatePaymentInput } from "../types";

export function usePayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const retry = useCallback(() => {
    setIsLoading(true);
    try {
      setPayments(paymentRepository.getAll());
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(retry, 0);
    return () => window.clearTimeout(timeoutId);
  }, [retry]);

  const createPayment = useCallback((input: CreatePaymentInput): boolean => {
    const payment: Payment = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      ...input,
    };

    try {
      paymentRepository.create(payment);
      setPayments((prev) => [...prev, payment]);
      return true;
    } catch {
      return false;
    }
  }, []);

  const updatePayment = useCallback((input: UpdatePaymentInput): boolean => {
    const current = payments.find((payment) => payment.id === input.id);
    if (!current) return false;
    const updated: Payment = { ...current, ...input };

    try {
      paymentRepository.update(updated);
      setPayments((prev) =>
        prev.map((payment) => (payment.id === updated.id ? updated : payment)),
      );
      return true;
    } catch {
      return false;
    }
  }, [payments]);

  const deletePayment = useCallback((id: string): boolean => {
    try {
      paymentRepository.delete(id);
      setPayments((prev) => prev.filter((payment) => payment.id !== id));
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
    updatePayment,
    deletePayment,
    isLoading,
    loadError,
    retry,
  };
}
