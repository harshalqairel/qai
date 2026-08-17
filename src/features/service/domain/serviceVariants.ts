import type {
  Service,
  ServiceOptionGroup,
  ServiceSelectionSnapshot,
  ServiceVariant,
} from "@/features/service/types";

export function orderedOptionGroups(service: Pick<Service, "optionGroups">): ServiceOptionGroup[] {
  return [...(service.optionGroups ?? [])]
    .sort((left, right) => left.position - right.position)
    .map((group) => ({
      ...group,
      values: [...group.values].sort((left, right) => left.position - right.position),
    }));
}

export function activeServiceVariants(service: Pick<Service, "variants">): ServiceVariant[] {
  return (service.variants ?? []).filter((variant) => variant.active);
}

export function variantCombinationKey(optionValueIds: readonly string[]): string {
  return [...optionValueIds].sort().join(":");
}

export function resolveServiceVariant(
  service: Pick<Service, "optionGroups" | "variants">,
  selectedValueIds: readonly string[],
): ServiceVariant | null {
  const groups = orderedOptionGroups(service);
  if (groups.length === 0 || selectedValueIds.length !== groups.length) return null;
  const key = variantCombinationKey(selectedValueIds);
  return activeServiceVariants(service).find((variant) => variantCombinationKey(variant.optionValueIds) === key) ?? null;
}

export function defaultServiceVariant(service: Pick<Service, "optionGroups" | "variants">): ServiceVariant | null {
  const groups = orderedOptionGroups(service);
  if (groups.length === 0) return null;
  return activeServiceVariants(service).find((variant) =>
    groups.every((group) => variant.optionValueIds.some((id) => group.values.some((value) => value.id === id && value.active))),
  ) ?? null;
}

export function availableOptionValueIds(
  service: Pick<Service, "optionGroups" | "variants">,
  groupId: string,
  selectedByGroup: Readonly<Record<string, string>>,
): Set<string> {
  const groups = orderedOptionGroups(service);
  const target = groups.find((group) => group.id === groupId);
  if (!target) return new Set();
  const variants = activeServiceVariants(service);
  return new Set(target.values.filter((value) => value.active && variants.some((variant) => {
    if (!variant.optionValueIds.includes(value.id)) return false;
    return groups.every((group) => {
      if (group.id === groupId) return true;
      const selected = selectedByGroup[group.id];
      return !selected || variant.optionValueIds.includes(selected);
    });
  })).map((value) => value.id));
}

export function resolveVariantAfterOptionChange(
  service: Pick<Service, "optionGroups" | "variants">,
  groupId: string,
  valueId: string,
  selectedByGroup: Readonly<Record<string, string>>,
): ServiceVariant | null {
  const groups = orderedOptionGroups(service);
  const target = groups.find((group) => group.id === groupId);
  if (!target?.values.some((value) => value.id === valueId && value.active)) return null;
  const candidates = activeServiceVariants(service).filter((variant) => variant.optionValueIds.includes(valueId));
  return candidates.reduce<ServiceVariant | null>((best, candidate) => {
    if (!best) return candidate;
    const score = groups.filter((group) => group.id !== groupId && candidate.optionValueIds.includes(selectedByGroup[group.id])).length;
    const bestScore = groups.filter((group) => group.id !== groupId && best.optionValueIds.includes(selectedByGroup[group.id])).length;
    return score > bestScore ? candidate : best;
  }, null);
}

export function selectionForVariant(
  service: Pick<Service, "optionGroups">,
  variant: ServiceVariant | null,
): Record<string, string> {
  if (!variant) return {};
  return Object.fromEntries(orderedOptionGroups(service).flatMap((group) => {
    const value = group.values.find((candidate) => variant.optionValueIds.includes(candidate.id));
    return value ? [[group.id, value.id]] : [];
  }));
}

export function snapshotServiceSelection(service: Service, variant: ServiceVariant | null): ServiceSelectionSnapshot {
  const options = variant ? orderedOptionGroups(service).flatMap((group) => {
    const value = group.values.find((candidate) => variant.optionValueIds.includes(candidate.id));
    return value ? [{ groupId: group.id, groupName: group.name, valueId: value.id, valueLabel: value.label }] : [];
  }) : [];
  return {
    serviceName: service.name,
    variantId: variant?.id ?? null,
    variantLabel: variant?.displayLabel.trim() || options.map((option) => option.valueLabel).join(" · "),
    options,
    price: variant?.price ?? service.price,
    duration: variant?.duration ?? service.duration,
    defaultSessionCount: variant?.defaultSessionCount ?? service.defaultSessionCount,
  };
}

export function validateServiceVariantConfiguration(
  optionGroups: readonly ServiceOptionGroup[],
  variants: readonly ServiceVariant[],
): string | null {
  if (optionGroups.length > 4) return "A service can have up to four option groups.";
  const normalizedGroupNames = optionGroups.map((group) => group.name.normalize("NFKC").trim().toLowerCase());
  if (normalizedGroupNames.some((name) => !name)) return "Every option group needs a name.";
  if (new Set(normalizedGroupNames).size !== normalizedGroupNames.length) return "Option group names must be unique.";
  const allValueIds = new Set<string>();
  for (const group of optionGroups) {
    if (group.values.length < 1 || group.values.length > 12) return "Each option group needs between one and twelve values.";
    const labels = group.values.map((value) => value.label.normalize("NFKC").trim().toLowerCase());
    if (labels.some((label) => !label) || new Set(labels).size !== labels.length) return "Option values must be named and unique within their group.";
    for (const value of group.values) {
      if (allValueIds.has(value.id)) return "Option value IDs must be unique.";
      allValueIds.add(value.id);
    }
  }
  if (optionGroups.length === 0 && variants.length > 0) return "Add an option group before adding variants.";
  const combinations = new Set<string>();
  for (const variant of variants) {
    if (variant.price < 0 || variant.duration < 1 || variant.defaultSessionCount < 1) return "Every variant needs a valid price, duration, and schedule count.";
    if (variant.optionValueIds.length !== optionGroups.length || variant.optionValueIds.some((id) => !allValueIds.has(id))) return "Each variant must choose one value from every option group.";
    const hasOnePerGroup = optionGroups.every((group) => variant.optionValueIds.filter((id) => group.values.some((value) => value.id === id)).length === 1);
    if (!hasOnePerGroup) return "Each variant must choose exactly one value from every option group.";
    const key = variantCombinationKey(variant.optionValueIds);
    if (combinations.has(key)) return "Variant combinations must be unique.";
    combinations.add(key);
  }
  return null;
}
