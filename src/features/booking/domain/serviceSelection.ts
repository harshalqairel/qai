import type { Service } from "@/features/service/types";

export function servicesAvailableForNewBooking(services: readonly Service[]): Service[] {
  return services.filter((service) => service.active);
}

export function serviceCanBeSelectedForBooking(service: Service, currentServiceId?: string): boolean {
  return service.active || service.id === currentServiceId;
}
