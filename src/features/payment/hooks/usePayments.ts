"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { paymentRepository } from "../api/paymentRepository";
import { CreatePaymentInput, Payment, UpdatePaymentInput } from "../types";
import { PAYMENT_STORAGE_KEY } from "../constants";
import { toPersistenceError } from "@/lib/persistence";
import type { PersistenceErrorCode } from "@/lib/persistence";

export function usePayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [persistenceErrorCode, setPersistenceErrorCode] =
    useState<PersistenceErrorCode | null>(null);

  useEffect(() => {
    try {
      setPayments(paymentRepository.getAll());
      setPersistenceErrorCode(null);
    } catch (error) {
      setPersistenceErrorCode(toPersistenceError(error, PAYMENT_STORAGE_KEY).code);
    }
  }, []);

  const createPayment = useCallback((input: CreatePaymentInput): Payment => {
    const payment: Payment = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      ...input,
    };

    try {
      paymentRepository.create(payment);
      setPayments((prev) => [...prev, payment]);
      setPersistenceErrorCode(null);
    } catch (error) {
      setPersistenceErrorCode(toPersistenceError(error, PAYMENT_STORAGE_KEY).code);
    }

    return payment;
  }, []);

  const updatePayment = useCallback((input: UpdatePaymentInput): void => {
    const current = payments.find((payment) => payment.id === input.id);
    if (!current) return;
    const updated: Payment = { ...current, ...input };

    try {
      paymentRepository.update(updated);
      setPayments((prev) =>
        prev.map((payment) => (payment.id === updated.id ? updated : payment)),
      );
      setPersistenceErrorCode(null);
    } catch (error) {
      setPersistenceErrorCode(toPersistenceError(error, PAYMENT_STORAGE_KEY).code);
    }
  }, [payments]);

  const deletePayment = useCallback((id: string): void => {
    try {
      paymentRepository.delete(id);
      setPayments((prev) => prev.filter((payment) => payment.id !== id));
      setPersistenceErrorCode(null);
    } catch (error) {
      setPersistenceErrorCode(toPersistenceError(error, PAYMENT_STORAGE_KEY).code);
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
    persistenceErrorCode,
  };
}
