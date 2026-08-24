// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import ServiceVariantEditor from "./ServiceVariantEditor";

const groups = [
  { id: "artist", name: "Artist", position: 0, values: [{ id: "owner", label: "Owner", active: true, position: 0 }, { id: "mentor", label: "Mentor", active: true, position: 1 }] },
  { id: "sessions", name: "Sessions", position: 1, values: [{ id: "one", label: "1x", active: true, position: 0 }, { id: "two", label: "2x", active: true, position: 1 }] },
];

const existing = { id: "owner-one", optionValueIds: ["owner", "one"], displayLabel: "Owner · 1x", price: 2_100_000, duration: 120, defaultSessionCount: 1, active: true };

afterEach(cleanup);

describe("ServiceVariantEditor", () => {
  it("adds the next unused combination and renders a live client preview", async () => {
    const user = userEvent.setup();
    const onVariantsChange = vi.fn();
    render(<ServiceVariantEditor optionGroups={groups} variants={[existing]} basePrice={1_000_000} baseDuration={60} baseSessionCount={1} onOptionGroupsChange={vi.fn()} onVariantsChange={onVariantsChange} />);

    expect(screen.getByLabelText("Client choice preview")).toBeTruthy();
    expect(screen.getAllByText("Owner · 1x").length).toBeGreaterThanOrEqual(1);
    await user.click(screen.getByRole("button", { name: "Add combination" }));
    expect(onVariantsChange).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ optionValueIds: ["owner", "two"] })]));
  });

  it("duplicates pricing into an unused combination instead of creating an invalid duplicate", async () => {
    const user = userEvent.setup();
    const onVariantsChange = vi.fn();
    render(<ServiceVariantEditor optionGroups={groups} variants={[existing]} basePrice={1_000_000} baseDuration={60} baseSessionCount={1} onOptionGroupsChange={vi.fn()} onVariantsChange={onVariantsChange} />);
    await user.click(screen.getByRole("button", { name: "Duplicate combination 1" }));
    expect(onVariantsChange).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ optionValueIds: ["owner", "two"], price: 2_100_000, duration: 120 })]));
  });

  it("keeps choice names, values, and combination selections distinct", async () => {
    const user = userEvent.setup();
    const onOptionGroupsChange = vi.fn();
    const onVariantsChange = vi.fn();
    render(<ServiceVariantEditor optionGroups={groups} variants={[existing]} basePrice={1_000_000} baseDuration={60} baseSessionCount={1} onOptionGroupsChange={onOptionGroupsChange} onVariantsChange={onVariantsChange} />);

    expect(screen.getAllByText("Choice name")).toHaveLength(2);
    expect(screen.getAllByText("Values")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Add another choice type" })).toBeTruthy();

    const addValueButtons = screen.getAllByRole("button", { name: "Add value" });
    await user.click(addValueButtons[2]);
    await user.type(screen.getByRole("textbox", { name: "New value for Artist" }), "Senior Artist");
    await user.click(screen.getByRole("button", { name: "Add and select" }));

    expect(onOptionGroupsChange).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        id: "artist",
        values: expect.arrayContaining([expect.objectContaining({ label: "Senior Artist" })]),
      }),
    ]));
    expect(onVariantsChange).toHaveBeenCalledWith([
      expect.objectContaining({ optionValueIds: expect.arrayContaining(["one"]) }),
    ]);
  });
});
