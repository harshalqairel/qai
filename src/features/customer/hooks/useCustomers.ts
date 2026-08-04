"use client";

import { useCallback, useEffect, useState } from "react";

import {
  Customer,
  CreateCustomerInput,
  UpdateCustomerInput,
} from "../types";
import { customerRepository } from "../api/customerRepository";
import { subscribeToDataRefresh } from "@/lib/dataRefresh";

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const retry = useCallback(() => {
    setIsLoading(true);
    try {
      setCustomers(customerRepository.getAll());
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(retry, 0);
    const unsubscribe = subscribeToDataRefresh(retry);
    return () => {
      window.clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [retry]);

  const createCustomer = useCallback((input: CreateCustomerInput): boolean => {
    const newCustomer: Customer = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      ...input,
    };

    try {
      customerRepository.create(newCustomer);
      setCustomers((prev) => [...prev, newCustomer]);
      return true;
    } catch {
      return false;
    }
  }, []);

  const updateCustomer = useCallback((input: UpdateCustomerInput): boolean => {
    const current = customers.find((customer) => customer.id === input.id);
    if (!current) return false;
    const updated: Customer = { ...current, ...input };

    try {
      customerRepository.update(updated);
      setCustomers((prev) =>
        prev.map((customer) => (customer.id === updated.id ? updated : customer)),
      );
      return true;
    } catch {
      return false;
    }
  }, [customers]);

  const deleteCustomer = useCallback((id: string): boolean => {
    try {
      customerRepository.delete(id);
      setCustomers((prev) => prev.filter((customer) => customer.id !== id));
      return true;
    } catch {
      return false;
    }
  }, []);

  return {
    customers,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    isLoading,
    loadError,
    retry,
  };
}
