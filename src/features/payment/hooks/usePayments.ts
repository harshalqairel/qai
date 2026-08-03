"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { paymentRepository } from "../api/paymentRepository";
import { CreatePaymentInput, Payment, UpdatePaymentInput } from "../types";

export function usePayments() {
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    try {
      setPayments(paymentRepository.getAll());
    } catch (_error) {
      setPayments([]);
    }
  }, []);

  const createPayment = useCallback((input: CreatePaymentInput): Payment => {
    const payment: Payment = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      ...input,
    };

    setPayments((prev) => [...prev, payment]);

    try {
      paymentRepository.create(payment);
    } catch (_error) {
      // noop
    }

    return payment;
  }, []);

  const updatePayment = useCallback((input: UpdatePaymentInput): void => {
    setPayments((prev) => {
      const next = prev.map((payment) => (payment.id === input.id ? { ...payment, ...input } : payment));
      const updated = next.find((payment) => payment.id === input.id);
      if (updated) {
        try {
          paymentRepository.update(updated);
        } catch (_error) {
          // noop
        }
      }
      return next;
    });
  }, []);

  const deletePayment = useCallback((id: string): void => {
    setPayments((prev) => prev.filter((payment) => payment.id !== id));

    try {
      paymentRepository.delete(id);
    } catch (_error) {
      // noop
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
  };
}
