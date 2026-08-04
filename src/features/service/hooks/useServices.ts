"use client";

import { useCallback, useEffect, useState } from "react";
import { Service, CreateServiceInput } from "../types";
import { serviceRepository } from "../api/serviceRepository";
import { subscribeToDataRefresh } from "@/lib/dataRefresh";

export function useServices(): {
  services: Service[];
  createService: (input: CreateServiceInput) => boolean;
  updateService: (service: Service) => boolean;
  deleteService: (id: string) => boolean;
  isLoading: boolean;
  loadError: boolean;
  retry: () => void;
} {
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const retry = useCallback(() => {
    setIsLoading(true);
    try {
      setServices(serviceRepository.getAll());
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

  const createService = useCallback((input: CreateServiceInput): boolean => {
    const newService: Service = {
      id: crypto.randomUUID(),
      active: true,
      name: input.name,
      categoryId: input.categoryId,
      price: input.price,
      duration: input.duration,
      description: input.description,
    };

    try {
      serviceRepository.create(newService);
      setServices((prev) => [...prev, newService]);
      return true;
    } catch {
      return false;
    }
  }, []);

  const updateService = useCallback((service: Service): boolean => {
    try {
      serviceRepository.update(service);
      setServices((prev) => prev.map((item) => (item.id === service.id ? service : item)));
      return true;
    } catch {
      return false;
    }
  }, []);

  const deleteService = useCallback((id: string): boolean => {
    try {
      serviceRepository.delete(id);
      setServices((prev) => prev.filter((service) => service.id !== id));
      return true;
    } catch {
      return false;
    }
  }, []);

  return {
    services,
    createService,
    updateService,
    deleteService,
    isLoading,
    loadError,
    retry,
  };
}
