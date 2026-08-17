import { describe, expect, it } from "vitest";
import type { Service } from "@/features/service/types";
import { availableOptionValueIds, resolveServiceVariant, resolveVariantAfterOptionChange, selectionForVariant, snapshotServiceSelection, validateServiceVariantConfiguration } from "./serviceVariants";

const service: Service = {
  id: "service-1", name: "Makeup", categoryId: "category-1", price: 1_000_000, duration: 60, defaultSessionCount: 1, description: "", active: true,
  optionGroups: [
    { id: "artist", name: "Artist", position: 0, values: [{ id: "owner", label: "Owner", active: true, position: 0 }, { id: "mentor", label: "Mentor", active: true, position: 1 }] },
    { id: "sessions", name: "Sessions", position: 1, values: [{ id: "one", label: "1 meeting", active: true, position: 0 }, { id: "two", label: "2 meetings", active: true, position: 1 }] },
  ],
  variants: [
    { id: "owner-one", optionValueIds: ["owner", "one"], displayLabel: "Owner · 1 meeting", price: 2_100_000, duration: 120, defaultSessionCount: 1, active: true },
    { id: "mentor-two", optionValueIds: ["mentor", "two"], displayLabel: "", price: 1_500_000, duration: 200, defaultSessionCount: 2, active: true },
  ],
};

describe("service variants", () => {
  it("resolves only configured combinations and exposes compatible values", () => {
    expect(resolveServiceVariant(service, ["owner", "one"])?.id).toBe("owner-one");
    expect(resolveServiceVariant(service, ["owner", "two"])).toBeNull();
    expect([...availableOptionValueIds(service, "sessions", { artist: "owner" })]).toEqual(["one"]);
    const ownerSelection = selectionForVariant(service, service.variants?.[0] ?? null);
    expect(resolveVariantAfterOptionChange(service, "artist", "mentor", ownerSelection)?.id).toBe("mentor-two");
  });

  it("snapshots labels and financial defaults for historical bookings", () => {
    const snapshot = snapshotServiceSelection(service, service.variants?.[1] ?? null);
    expect(snapshot).toMatchObject({ serviceName: "Makeup", variantId: "mentor-two", variantLabel: "Mentor · 2 meetings", price: 1_500_000, duration: 200, defaultSessionCount: 2 });
  });

  it("rejects duplicate or incomplete combinations", () => {
    const firstVariant = service.variants?.[0];
    expect(firstVariant).toBeDefined();
    if (!firstVariant) throw new Error("Fixture variant is required.");
    expect(validateServiceVariantConfiguration(service.optionGroups ?? [], service.variants ?? [])).toBeNull();
    expect(validateServiceVariantConfiguration(service.optionGroups ?? [], [...(service.variants ?? []), { ...firstVariant, id: "duplicate" }])).toMatch(/unique/i);
  });
});
