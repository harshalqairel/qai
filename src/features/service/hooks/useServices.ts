"use client";

import { useCallback, useEffect, useState } from "react";
import { Service, CreateServiceInput } from "../types";
import { serviceRepository } from "../api/serviceRepository";

export function useServices(): {
  services: Service[];
  createService: (input: CreateServiceInput) => Service;
  updateService: (service: Service) => void;
  deleteService: (id: string) => void;
} {
  const [services, setServices] = useState<Service[]>([]);

  useEffect(() => {
    try {
      const loaded = serviceRepository.getAll();
      setServices(loaded);
    } catch (error) {
      console.error("Failed to load services from repository:", error);
      setServices([]);
    }
  }, []);

  const createService = useCallback((input: CreateServiceInput): Service => {
    const newService: Service = {
      id: crypto.randomUUID(),
      active: true,
      name: input.name,
      category: input.category,
      price: input.price,
      duration: input.duration,
      description: input.description,
    };

    setServices((prev) => {
      const next = [...prev, newService];

      try {
        serviceRepository.save(next);
      } catch (error) {
        console.error("Failed to persist services:", error);
      }

      return next;
    });

    return newService;
  }, []);

  const updateService = useCallback((service: Service): void => {
    setServices((prev) => {
      const next = prev.map((s) => (s.id === service.id ? service : s));

      try {
        serviceRepository.save(next);
      } catch (error) {
        console.error("Failed to persist services:", error);
      }

      return next;
    });
  }, []);

  const deleteService = useCallback((id: string): void => {
    setServices((prev) => {
      const next = prev.filter((s) => s.id !== id);

      try {
        serviceRepository.save(next);
      } catch (error) {
        console.error("Failed to persist services:", error);
      }

      return next;
    });
  }, []);

  return {
    services,
    createService,
    updateService,
    deleteService,
  };
}