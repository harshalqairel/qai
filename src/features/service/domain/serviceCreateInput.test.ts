import { describe, expect, it } from "vitest";

import { serviceCreateInputFromRecord } from "./serviceCreateInput";

describe("service create input", () => {
  it("preserves location and client choices when a new service is saved", () => {
    const choice = { id: "artist", name: "Artist", position: 0, values: [{ id: "owner", label: "Owner", active: true, position: 0 }] };
    const combination = { id: "owner", optionValueIds: ["owner"], displayLabel: "Owner", price: 2_000_000, duration: 120, defaultSessionCount: 2, active: true };
    expect(serviceCreateInputFromRecord({ id: "service", name: "Makeup", categoryId: "makeup", price: 1_500_000, duration: 90, defaultSessionCount: 1, locationPolicy: "Client location only", optionGroups: [choice], variants: [combination], description: "", active: true })).toMatchObject({
      locationPolicy: "Client location only",
      optionGroups: [choice],
      variants: [combination],
    });
  });
});
