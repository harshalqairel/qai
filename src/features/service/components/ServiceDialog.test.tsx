// @vitest-environment happy-dom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import ServiceDialog from "./ServiceDialog";
import type { Service } from "@/features/service/types";

const category = {
  id: "category-1",
  name: "Makeup",
  color: "category-blue",
  active: true,
  createdAt: "2026-08-27T00:00:00.000Z",
  updatedAt: "2026-08-27T00:00:00.000Z",
};

afterEach(cleanup);

const service: Service = {
  id: "service-1",
  name: "Bridal Makeup",
  categoryId: category.id,
  price: 1_500_000,
  duration: 90,
  defaultSessionCount: 1,
  locationPolicy: "Client can choose",
  optionGroups: [],
  variants: [],
  description: "Bridal service",
  active: false,
};

describe("ServiceDialog overlay interactions", () => {
  it("creates an inline category and returns focus without a delayed timer", async () => {
    const user = userEvent.setup();
    const onQuickCreateCategory = vi.fn(async () => ({ ...category, id: "category-2", name: "Bridal" }));
    render(
      <ServiceDialog
        open
        service={null}
        categories={[category]}
        onClose={vi.fn()}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onQuickCreateCategory={onQuickCreateCategory}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Add category" }));
    await user.type(screen.getByLabelText("Category name"), "Bridal");
    await user.click(screen.getAllByRole("button", { name: "Add category" })[1]!);

    await waitFor(() => expect(onQuickCreateCategory).toHaveBeenCalledOnce());
    expect(screen.queryByLabelText("Category name")).toBeNull();
    expect(document.activeElement).toBe(screen.getAllByRole("combobox")[0]);
  });

  it("defaults a new service to active", () => {
    render(
      <ServiceDialog
        open
        service={null}
        categories={[category]}
        onClose={vi.fn()}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
      />,
    );

    expect((screen.getByRole("switch", { name: /^Service active/ }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText("Available for new bookings and applicable public surfaces.")).not.toBeNull();
  });

  it("edits and persists the service active state", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn(async () => true);
    render(
      <ServiceDialog
        open
        service={service}
        categories={[category]}
        onClose={vi.fn()}
        onCreate={vi.fn()}
        onUpdate={onUpdate}
      />,
    );

    const activeSwitch = screen.getByRole("switch", { name: /^Service active/ }) as HTMLInputElement;
    expect(activeSwitch.checked).toBe(false);
    expect(screen.getByText("Hidden from new bookings and public availability. Existing bookings and history are preserved.")).not.toBeNull();

    await user.click(activeSwitch);
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: service.id, active: true })));
  });
});
