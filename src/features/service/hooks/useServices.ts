"use client";

import { useCallback, useEffect, useState } from "react";
import { Service, CreateServiceInput } from "../types";
import { serviceRepository } from "../api/serviceRepository";
import { SERVICE_STORAGE_KEY } from "../constants";
import { toPersistenceError } from "@/lib/persistence";
import type { PersistenceErrorCode } from "@/lib/persistence";

export function useServices(): {
  services: Service[];
  createService: (input: CreateServiceInput) => Service;
  updateService: (service: Service) => void;
  deleteService: (id: string) => void;
  persistenceErrorCode: PersistenceErrorCode | null;
} {
  const [services, setServices] = useState<Service[]>([]);
  const [persistenceErrorCode, setPersistenceErrorCode] =
    useState<PersistenceErrorCode | null>(null);

  useEffect(() => {
    try {
      const loaded = serviceRepository.getAll();
      setServices(loaded);
      setPersistenceErrorCode(null);
    } catch (error) {
      setPersistenceErrorCode(toPersistenceError(error, SERVICE_STORAGE_KEY).code);
    }
  }, []);

  const createService = useCallback((input: CreateServiceInput): Service => {
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
      setPersistenceErrorCode(null);
    } catch (error) {
      setPersistenceErrorCode(toPersistenceError(error, SERVICE_STORAGE_KEY).code);
    }

    return newService;
  }, []);

  const updateService = useCallback((service: Service): void => {
    try {
      serviceRepository.update(service);
      setServices((prev) => prev.map((item) => (item.id === service.id ? service : item)));
      setPersistenceErrorCode(null);
    } catch (error) {
      setPersistenceErrorCode(toPersistenceError(error, SERVICE_STORAGE_KEY).code);
    }
  }, []);

  const deleteService = useCallback((id: string): void => {
    try {
      serviceRepository.delete(id);
      setServices((prev) => prev.filter((service) => service.id !== id));
      setPersistenceErrorCode(null);
    } catch (error) {
      setPersistenceErrorCode(toPersistenceError(error, SERVICE_STORAGE_KEY).code);
    }
  }, []);

  return {
    services,
    createService,
    updateService,
    deleteService,
    persistenceErrorCode,
  };
}
