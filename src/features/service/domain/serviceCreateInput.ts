import type { CreateServiceInput, Service } from "@/features/service/types";

export function serviceCreateInputFromRecord(service: Service): CreateServiceInput {
  return {
    name: service.name,
    categoryId: service.categoryId,
    price: service.price,
    duration: service.duration,
    defaultSessionCount: service.defaultSessionCount,
    locationPolicy: service.locationPolicy,
    optionGroups: service.optionGroups,
    variants: service.variants,
    description: service.description,
  };
}
