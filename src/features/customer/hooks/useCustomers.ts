"use client";

import { useCallback, useEffect, useState } from "react";

import {
  Customer,
  CreateCustomerInput,
  UpdateCustomerInput,
} from "../types";
import { customerRepository } from "../api/customerRepository";

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    try {
      const loaded = customerRepository.getAll();
      setCustomers(loaded);
    } catch (_error) {
      setCustomers([]);
    }
  }, []);

  const createCustomer = useCallback((input: CreateCustomerInput): Customer => {
    const newCustomer: Customer = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      ...input,
    };

    // update local state
    setCustomers((prev) => {
      const next = [...prev, newCustomer];
      return next;
    });

    // persist single entity (repository will read/merge/write)
    try {
      customerRepository.create(newCustomer);
    } catch (_error) {
      // noop
    }

    return newCustomer;
  }, []);

  const updateCustomer = useCallback((input: UpdateCustomerInput): void => {
    setCustomers((prev) => {
      const next = prev.map((customer) =>
        customer.id === input.id
          ? {
              ...customer,
              ...input,
            }
          : customer,
      );

      return next;
    });

    try {
      customerRepository.update(input as Customer);
    } catch (_error) {
      // noop
    }
  }, []);

  const deleteCustomer = useCallback((id: string): void => {
    setCustomers((prev) => prev.filter((customer) => customer.id !== id));

    try {
      customerRepository.delete(id);
    } catch (_error) {
      // noop
    }
  }, []);

  return {
    customers,
    createCustomer,
    updateCustomer,
    deleteCustomer,
  };
}
