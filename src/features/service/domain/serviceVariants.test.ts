import { describe, expect, it } from "vitest";
import type { Service } from "@/features/service/types";
import {
  availableOptionValueIds,
  hasExactlyOneOptionValuePerGroup,
  resolveServiceVariant,
  resolveVariantAfterOptionChange,
  selectionForVariant,
  snapshotServiceSelection,
  synchronizeServiceVariants,
  validateServiceVariantConfiguration,
} from "./serviceVariants";

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

  it("accepts services with no choices and valid one-, two-, and three-choice combinations", () => {
    const artist = service.optionGroups?.[0];
    const sessions = service.optionGroups?.[1];
    expect(artist).toBeDefined();
    expect(sessions).toBeDefined();
    if (!artist || !sessions) throw new Error("Choice fixtures are required.");
    const location = { id: "location", name: "Location", position: 2, values: [{ id: "studio", label: "Studio", active: true, position: 0 }] };
    const base = service.variants?.[0];
    expect(base).toBeDefined();
    if (!base) throw new Error("Combination fixture is required.");

    expect(validateServiceVariantConfiguration([], [])).toBeNull();
    expect(validateServiceVariantConfiguration([artist], [{ ...base, optionValueIds: ["owner"] }])).toBeNull();
    expect(validateServiceVariantConfiguration([artist, sessions], [base])).toBeNull();
    expect(validateServiceVariantConfiguration([artist, sessions, location], [{ ...base, optionValueIds: ["owner", "one", "studio"] }])).toBeNull();
  });

  it("adds a deterministic stored value for a newly introduced choice without resetting metadata", () => {
    const artist = service.optionGroups?.[0];
    const sessions = service.optionGroups?.[1];
    const base = service.variants?.[0];
    expect(artist).toBeDefined();
    expect(sessions).toBeDefined();
    expect(base).toBeDefined();
    if (!artist || !sessions || !base) throw new Error("Fixtures are required.");

    const [synchronized] = synchronizeServiceVariants([artist, sessions], [{ ...base, optionValueIds: ["owner"] }]);
    expect(synchronized).toEqual({ ...base, optionValueIds: ["owner", "one"] });
    expect(hasExactlyOneOptionValuePerGroup([artist, sessions], synchronized.optionValueIds)).toBe(true);
  });

  it("preserves stable combination references through value additions and renames", () => {
    const groups = structuredClone(service.optionGroups ?? []);
    const variants = structuredClone(service.variants ?? []);
    groups[0].values.push({ id: "senior", label: "Senior", active: true, position: 2 });
    groups[1].values[0].label = "Single meeting";

    expect(synchronizeServiceVariants(groups, variants)).toEqual(variants);
  });

  it("replaces a removed selected value deterministically and leaves no dangling identity", () => {
    const groups = structuredClone(service.optionGroups ?? []);
    const base = structuredClone(service.variants?.[0]);
    expect(base).toBeDefined();
    if (!base) throw new Error("Combination fixture is required.");
    groups[0].values = groups[0].values.filter((value) => value.id !== "owner").map((value, position) => ({ ...value, position }));

    const [synchronized] = synchronizeServiceVariants(groups, [base]);
    expect(synchronized.optionValueIds).toEqual(["mentor", "one"]);
    expect(synchronized).toMatchObject({ id: "owner-one", price: 2_100_000, duration: 120, defaultSessionCount: 1 });
    expect(validateServiceVariantConfiguration(groups, [synchronized])).toBeNull();
  });

  it("removes a deleted choice value from combinations while preserving the remaining metadata", () => {
    const groups = structuredClone(service.optionGroups ?? []).slice(0, 1);
    const base = service.variants?.[0];
    expect(base).toBeDefined();
    if (!base) throw new Error("Combination fixture is required.");

    const [synchronized] = synchronizeServiceVariants(groups, [base]);
    expect(synchronized).toEqual({ ...base, optionValueIds: ["owner"] });
    expect(validateServiceVariantConfiguration(groups, [synchronized])).toBeNull();
  });

  it("removes all combinations when the final choice is removed", () => {
    expect(synchronizeServiceVariants([], service.variants ?? [])).toEqual([]);
  });

  it("preserves combination validity and identity when choices are reordered", () => {
    const groups = structuredClone(service.optionGroups ?? []).reverse().map((group, position) => ({ ...group, position }));
    const base = service.variants?.[0];
    expect(base).toBeDefined();
    if (!base) throw new Error("Combination fixture is required.");

    const [synchronized] = synchronizeServiceVariants(groups, [base]);
    expect(synchronized.id).toBe(base.id);
    expect(synchronized.optionValueIds).toEqual(["one", "owner"]);
    expect(validateServiceVariantConfiguration(groups, [synchronized])).toBeNull();
  });

  it("changing one choice selection preserves values from every other choice", () => {
    const groups = service.optionGroups ?? [];
    const base = service.variants?.[0];
    expect(base).toBeDefined();
    if (!base) throw new Error("Combination fixture is required.");
    const changed = { ...base, optionValueIds: base.optionValueIds.map((id) => id === "one" ? "two" : id) };

    expect(changed.optionValueIds).toEqual(["owner", "two"]);
    expect(hasExactlyOneOptionValuePerGroup(groups, changed.optionValueIds)).toBe(true);
  });

  it("rejects duplicate same-group, missing, and unknown values", () => {
    const groups = service.optionGroups ?? [];
    const base = service.variants?.[0];
    expect(base).toBeDefined();
    if (!base) throw new Error("Combination fixture is required.");

    expect(validateServiceVariantConfiguration(groups, [{ ...base, optionValueIds: ["owner", "mentor"] }])).toMatch(/exactly one/i);
    expect(validateServiceVariantConfiguration(groups, [{ ...base, optionValueIds: ["owner"] }])).toMatch(/exactly one/i);
    expect(validateServiceVariantConfiguration(groups, [{ ...base, optionValueIds: ["owner", "unknown"] }])).toMatch(/one value from every choice/i);
  });

  it("deduplicates combinations that collapse after a selected value is removed", () => {
    const groups = structuredClone(service.optionGroups ?? []);
    groups[0].values = [{ id: "mentor", label: "Mentor", active: true, position: 0 }];
    const base = service.variants?.[0];
    expect(base).toBeDefined();
    if (!base) throw new Error("Combination fixture is required.");
    const variants = [base, { ...base, id: "mentor-one", optionValueIds: ["mentor", "one"], price: 9_000_000 }];

    expect(synchronizeServiceVariants(groups, variants)).toEqual([{ ...base, optionValueIds: ["mentor", "one"] }]);
  });

  it("round-trips stable group, value, combination, price, and duration data", () => {
    const groups = structuredClone(service.optionGroups ?? []);
    const variants = structuredClone(service.variants ?? []);
    const persisted = JSON.parse(JSON.stringify({ optionGroups: groups, variants })) as { optionGroups: typeof groups; variants: typeof variants };

    expect(persisted).toEqual({ optionGroups: groups, variants });
    expect(validateServiceVariantConfiguration(persisted.optionGroups, persisted.variants)).toBeNull();
  });
});
