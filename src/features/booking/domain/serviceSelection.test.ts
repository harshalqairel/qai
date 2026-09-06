import { describe, expect, it } from "vitest";

import type { Service } from "@/features/service/types";
import { serviceCanBeSelectedForBooking, servicesAvailableForNewBooking } from "./serviceSelection";

const active: Service = { id: "active", name: "Active", categoryId: "category", price: 50_000, duration: 60, defaultSessionCount: 1, description: "", active: true };
const inactive: Service = { id: "inactive", name: "Inactive", categoryId: "category", price: 75_000, duration: 90, defaultSessionCount: 1, description: "", active: false };

describe("Booking service selection", () => {
  it("offers only active services for a new booking and restores reactivated services", () => {
    expect(servicesAvailableForNewBooking([active, inactive])).toEqual([active]);
    expect(servicesAvailableForNewBooking([active, { ...inactive, active: true }]).map((service) => service.id)).toEqual(["active", "inactive"]);
  });

  it("retains an inactive service only for the historical booking that already uses it", () => {
    expect(serviceCanBeSelectedForBooking(inactive)).toBe(false);
    expect(serviceCanBeSelectedForBooking(inactive, inactive.id)).toBe(true);
    expect(serviceCanBeSelectedForBooking(inactive, active.id)).toBe(false);
  });
});
