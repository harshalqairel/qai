"use client";

import { useCallback, useEffect, useState } from "react";
import { Service, CreateServiceInput } from "../types";
import { serviceRepository } from "../api/serviceRepository";
import { subscribeToDataRefresh } from "@/lib/dataRefresh";
import { isCloudModeEnabled } from "@/lib/supabase/config";
import { cloudServiceRepository } from "@/lib/supabase/cloudRepositories";

export function useServices(): {
  services: Service[];
  createService: (input: CreateServiceInput) => Promise<boolean>;
  createServiceAndReturn: (input: CreateServiceInput) => Promise<Service | null>;
  updateService: (service: Service) => Promise<boolean>;
  deleteService: (id: string) => Promise<boolean>;
  isLoading: boolean;
  loadError: boolean;
  retry: () => void;
} {
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const retry = useCallback(async () => {
    setIsLoading(true);
    try {
      const loaded = isCloudModeEnabled()
        ? await cloudServiceRepository.getAll()
        : serviceRepository.getAll();
      setServices(loaded);
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

  const createServiceAndReturn = useCallback(async (input: CreateServiceInput): Promise<Service | null> => {
    const newService: Service = {
      id: crypto.randomUUID(),
      active: true,
      name: input.name,
      categoryId: input.categoryId,
      price: input.price,
      duration: input.duration,
      defaultSessionCount: input.defaultSessionCount,
      locationPolicy: input.locationPolicy ?? "Client can choose",
      optionGroups: input.optionGroups ?? [],
      variants: input.variants ?? [],
      availability: input.availability,
      description: input.description,
    };

    try {
      if (isCloudModeEnabled()) await cloudServiceRepository.create(newService);
      else serviceRepository.create(newService);
      setServices((prev) => [...prev, newService]);
      return newService;
    } catch {
      return null;
    }
  }, []);

  const createService = useCallback(async (input: CreateServiceInput): Promise<boolean> => {
    return Boolean(await createServiceAndReturn(input));
  }, [createServiceAndReturn]);

  const updateService = useCallback(async (service: Service): Promise<boolean> => {
    try {
      if (isCloudModeEnabled()) await cloudServiceRepository.update(service);
      else serviceRepository.update(service);
      setServices((prev) => prev.map((item) => (item.id === service.id ? service : item)));
      return true;
    } catch {
      return false;
    }
  }, []);

  const deleteService = useCallback(async (id: string): Promise<boolean> => {
    try {
      if (isCloudModeEnabled()) await cloudServiceRepository.delete(id);
      else serviceRepository.delete(id);
      setServices((prev) => prev.filter((service) => service.id !== id));
      return true;
    } catch {
      return false;
    }
  }, []);

  return {
    services,
    createService,
    createServiceAndReturn,
    updateService,
    deleteService,
    isLoading,
    loadError,
    retry,
  };
}
