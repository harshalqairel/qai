import type { Service } from "@/features/service/types";
import { normalizeServiceAvailability } from "@/features/service/domain/serviceAvailability";
import type { PublicService } from "./validation";

export type PublicServiceMergeOptions = {
  includeInactive?: boolean;
};

function inheritedTitle(existing: PublicService | undefined, service: Service): boolean {
  if (!existing) return true;
  if (existing.titleSource) return existing.titleSource === "Service";
  return existing.title === service.name;
}

function inheritedPrice(existing: PublicService | undefined, service: Service): boolean {
  if (!existing) return true;
  if (existing.priceSource) return existing.priceSource === "Service";
  return existing.price === service.price;
}

/**
 * Combines live operational Service data with the intentionally separate Qai
 * Page presentation controls. Legacy page records keep a differing public
 * title/price as an override; matching values become explicit inheritance.
 */
export function mergePublicServices(
  configured: readonly PublicService[],
  operational: readonly Service[],
  options: PublicServiceMergeOptions = {},
): PublicService[] {
  const configuredById = new Map(configured.map((service) => [service.serviceId, service]));
  const orderedConfigured = [...configured].sort((left, right) => left.position - right.position || left.serviceId.localeCompare(right.serviceId));
  const configuredOrder = new Map(orderedConfigured.map((service, index) => [service.serviceId, index]));
  const nextPosition = orderedConfigured.length;

  return operational
    .filter((service) => options.includeInactive || service.active)
    .map((service, operationalIndex): PublicService => {
      const existing = configuredById.get(service.id);
      const titleSource = inheritedTitle(existing, service) ? "Service" : "Custom";
      const priceSource = inheritedPrice(existing, service) ? "Service" : "Custom";
      const position = configuredOrder.get(service.id) ?? nextPosition + operationalIndex;
      return {
        serviceId: service.id,
        visible: service.active && (existing?.visible ?? false),
        title: titleSource === "Service" ? service.name : existing?.title ?? service.name,
        titleSource,
        description: service.description,
        price: priceSource === "Service" ? service.price : existing?.price ?? service.price,
        priceSource,
        priceMode: existing?.priceMode ?? "Fixed price",
        actionMode: existing?.actionMode ?? "Booking request",
        durationMinutes: service.duration,
        defaultSessionCount: service.defaultSessionCount,
        locationPolicy: service.locationPolicy ?? "Client can choose",
        optionGroups: service.optionGroups ?? [],
        variants: service.variants ?? [],
        availability: normalizeServiceAvailability(service.availability),
        position,
        featured: existing?.featured ?? false,
      };
    })
    .sort((left, right) => left.position - right.position || left.serviceId.localeCompare(right.serviceId))
    .map((service, position) => ({ ...service, position }));
}

export function updatePublicServiceOrder(
  services: readonly PublicService[],
  serviceId: string,
  direction: -1 | 1,
): PublicService[] {
  const ordered = [...services].sort((left, right) => left.position - right.position || left.serviceId.localeCompare(right.serviceId));
  const index = ordered.findIndex((service) => service.serviceId === serviceId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ordered.length) return ordered.map((service, position) => ({ ...service, position }));
  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
  return ordered.map((service, position) => ({ ...service, position }));
}
