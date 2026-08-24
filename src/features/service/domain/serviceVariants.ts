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
  if (optionGroups.length > 4) return "A service can have up to four client choices.";
  const normalizedGroupNames = optionGroups.map((group) => group.name.normalize("NFKC").trim().toLowerCase());
  const unnamedGroupIndex = normalizedGroupNames.findIndex((name) => !name);
  if (unnamedGroupIndex >= 0) return `Choice ${unnamedGroupIndex + 1} → Give this choice a name, such as “Instructor”.`;
  const duplicateGroupIndex = normalizedGroupNames.findIndex((name, index) => normalizedGroupNames.indexOf(name) !== index);
  if (duplicateGroupIndex >= 0) return `Choice ${duplicateGroupIndex + 1} → “${optionGroups[duplicateGroupIndex].name.trim()}” is already used. Choice names must be unique.`;
  const allValueIds = new Set<string>();
  for (const [groupIndex, group] of optionGroups.entries()) {
    const groupLabel = group.name.trim() || `Choice ${groupIndex + 1}`;
    if (group.values.length < 1) return `${groupLabel} → Add at least one value.`;
    if (group.values.length > 12) return `${groupLabel} → Use no more than twelve values.`;
    const labels = group.values.map((value) => value.label.normalize("NFKC").trim().toLowerCase());
    const unnamedValueIndex = labels.findIndex((label) => !label);
    if (unnamedValueIndex >= 0) return `${groupLabel} → Value ${unnamedValueIndex + 1} needs a name.`;
    const duplicateValueIndex = labels.findIndex((label, index) => labels.indexOf(label) !== index);
    if (duplicateValueIndex >= 0) return `${groupLabel} → “${group.values[duplicateValueIndex].label.trim()}” is duplicated. Values within one choice must be unique.`;
    for (const value of group.values) {
      if (allValueIds.has(value.id)) return `${groupLabel} → A value has an invalid duplicate identity. Remove it and add the value again.`;
      allValueIds.add(value.id);
    }
  }
  if (optionGroups.length === 0 && variants.length > 0) return "Add a client choice before adding combinations.";
  const combinations = new Set<string>();
  for (const [variantIndex, variant] of variants.entries()) {
    const selectedLabels = optionGroups.flatMap((group) => group.values.filter((value) => variant.optionValueIds.includes(value.id)).map((value) => value.label.trim())).filter(Boolean);
    const combinationLabel = selectedLabels.join(" · ") || `Combination ${variantIndex + 1}`;
    if (!Number.isFinite(variant.price) || variant.price < 0) return `${combinationLabel} → Enter a valid price.`;
    if (!Number.isFinite(variant.duration) || variant.duration < 1) return `${combinationLabel} → Duration must be at least 1 minute.`;
    if (!Number.isInteger(variant.defaultSessionCount) || variant.defaultSessionCount < 1) return `${combinationLabel} → Schedules must be a whole number of at least 1.`;
    if (variant.optionValueIds.length !== optionGroups.length || variant.optionValueIds.some((id) => !allValueIds.has(id))) return `${combinationLabel} → Select one value from every choice.`;
    const hasOnePerGroup = optionGroups.every((group) => variant.optionValueIds.filter((id) => group.values.some((value) => value.id === id)).length === 1);
    if (!hasOnePerGroup) return `${combinationLabel} → Select exactly one value from every choice.`;
    const key = variantCombinationKey(variant.optionValueIds);
    if (combinations.has(key)) return `${combinationLabel} → This combination already exists. Every client-facing combination must be unique.`;
    combinations.add(key);
  }
  return null;
}
