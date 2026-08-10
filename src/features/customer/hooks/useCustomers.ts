"use client";

import { useCallback, useEffect, useState } from "react";

import {
  Customer,
  CreateCustomerInput,
  UpdateCustomerInput,
} from "../types";
import { customerRepository } from "../api/customerRepository";
import { subscribeToDataRefresh } from "@/lib/dataRefresh";
import { isCloudModeEnabled } from "@/lib/supabase/config";
import { cloudCustomerRepository } from "@/lib/supabase/cloudRepositories";

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const retry = useCallback(async () => {
    setIsLoading(true);
    try {
      const loaded = isCloudModeEnabled()
        ? await cloudCustomerRepository.getAll()
        : customerRepository.getAll();
      setCustomers(loaded);
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

  const createCustomer = useCallback(async (input: CreateCustomerInput): Promise<boolean> => {
    const newCustomer: Customer = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      ...input,
    };

    try {
      if (isCloudModeEnabled()) await cloudCustomerRepository.create(newCustomer);
      else customerRepository.create(newCustomer);
      setCustomers((prev) => [...prev, newCustomer]);
      return true;
    } catch {
      return false;
    }
  }, []);

  const updateCustomer = useCallback(async (input: UpdateCustomerInput): Promise<boolean> => {
    const current = customers.find((customer) => customer.id === input.id);
    if (!current) return false;
    const updated: Customer = { ...current, ...input };

    try {
      if (isCloudModeEnabled()) await cloudCustomerRepository.update(updated);
      else customerRepository.update(updated);
      setCustomers((prev) =>
        prev.map((customer) => (customer.id === updated.id ? updated : customer)),
      );
      return true;
    } catch {
      return false;
    }
  }, [customers]);

  const deleteCustomer = useCallback(async (id: string): Promise<boolean> => {
    try {
      if (isCloudModeEnabled()) await cloudCustomerRepository.delete(id);
      else customerRepository.delete(id);
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
