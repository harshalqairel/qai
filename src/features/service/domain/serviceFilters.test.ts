import { describe, expect, it } from "vitest";

import type { Service } from "@/features/service/types";
import { filterServices } from "./serviceFilters";

const services: Service[] = [
  { id: "active-makeup", name: "Bridal Makeup", categoryId: "makeup", price: 1, duration: 60, defaultSessionCount: 1, description: "Wedding service", active: true },
  { id: "inactive-makeup", name: "Archived Makeup", categoryId: "makeup", price: 1, duration: 60, defaultSessionCount: 1, description: "Previous service", active: false },
  { id: "active-class", name: "Studio Class", categoryId: "class", price: 1, duration: 60, defaultSessionCount: 1, description: "Group training", active: true },
];

const categoryNameById = new Map([
  ["makeup", "Makeup"],
  ["class", "Education"],
]);

function filtered(overrides: Partial<Parameters<typeof filterServices>[1]> = {}) {
  return filterServices(services, {
    search: "",
    categoryId: "",
    status: "all",
    categoryNameById,
    ...overrides,
  }).map((service) => service.id);
}

describe("service filtering", () => {
  it("supports All, Active, and Inactive status views", () => {
    expect(filtered({ status: "all" })).toEqual(["active-makeup", "inactive-makeup", "active-class"]);
    expect(filtered({ status: "active" })).toEqual(["active-makeup", "active-class"]);
    expect(filtered({ status: "inactive" })).toEqual(["inactive-makeup"]);
  });

  it("combines search, category, and status filters", () => {
    expect(filtered({ search: "previous", status: "inactive" })).toEqual(["inactive-makeup"]);
    expect(filtered({ search: "makeup", status: "active" })).toEqual(["active-makeup"]);
    expect(filtered({ categoryId: "makeup", status: "inactive" })).toEqual(["inactive-makeup"]);
    expect(filtered({ categoryId: "class", status: "inactive" })).toEqual([]);
  });
});
