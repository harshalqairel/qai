"use client";

import { useCallback, useEffect, useState } from "react";

import {
  Customer,
  CreateCustomerInput,
  UpdateCustomerInput,
} from "../types";
import { customerRepository } from "../api/customerRepository";
import { CUSTOMER_STORAGE_KEY } from "../constants";
import { toPersistenceError } from "@/lib/persistence";
import type { PersistenceErrorCode } from "@/lib/persistence";

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [persistenceErrorCode, setPersistenceErrorCode] =
    useState<PersistenceErrorCode | null>(null);

  useEffect(() => {
    try {
      const loaded = customerRepository.getAll();
      setCustomers(loaded);
      setPersistenceErrorCode(null);
    } catch (error) {
      setPersistenceErrorCode(toPersistenceError(error, CUSTOMER_STORAGE_KEY).code);
    }
  }, []);

  const createCustomer = useCallback((input: CreateCustomerInput): Customer => {
    const newCustomer: Customer = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      ...input,
    };

    try {
      customerRepository.create(newCustomer);
      setCustomers((prev) => [...prev, newCustomer]);
      setPersistenceErrorCode(null);
    } catch (error) {
      setPersistenceErrorCode(toPersistenceError(error, CUSTOMER_STORAGE_KEY).code);
    }

    return newCustomer;
  }, []);

  const updateCustomer = useCallback((input: UpdateCustomerInput): void => {
    const current = customers.find((customer) => customer.id === input.id);
    if (!current) return;
    const updated: Customer = { ...current, ...input };

    try {
      customerRepository.update(updated);
      setCustomers((prev) =>
        prev.map((customer) => (customer.id === updated.id ? updated : customer)),
      );
      setPersistenceErrorCode(null);
    } catch (error) {
      setPersistenceErrorCode(toPersistenceError(error, CUSTOMER_STORAGE_KEY).code);
    }
  }, [customers]);

  const deleteCustomer = useCallback((id: string): void => {
    try {
      customerRepository.delete(id);
      setCustomers((prev) => prev.filter((customer) => customer.id !== id));
      setPersistenceErrorCode(null);
    } catch (error) {
      setPersistenceErrorCode(toPersistenceError(error, CUSTOMER_STORAGE_KEY).code);
    }
  }, []);

  return {
    customers,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    persistenceErrorCode,
  };
}
