import type { Service } from "@/features/service/types";

export type ServiceStatusFilter = "all" | "active" | "inactive";

type ServiceFilterOptions = {
  search: string;
  categoryId: string;
  status: ServiceStatusFilter;
  categoryNameById: ReadonlyMap<string, string>;
};

export function filterServices(
  services: readonly Service[],
  { search, categoryId, status, categoryNameById }: ServiceFilterOptions,
): Service[] {
  const keyword = search.trim().toLowerCase();

  return services.filter((service) => {
    const matchesSearch = keyword === ""
      || service.name.toLowerCase().includes(keyword)
      || (categoryNameById.get(service.categoryId) ?? "Category not found").toLowerCase().includes(keyword)
      || service.description.toLowerCase().includes(keyword);
    const matchesCategory = categoryId === "" || service.categoryId === categoryId;
    const matchesStatus = status === "all"
      || (status === "active" ? service.active : !service.active);

    return matchesSearch && matchesCategory && matchesStatus;
  });
}
