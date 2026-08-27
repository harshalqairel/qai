// @vitest-environment happy-dom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import ServiceDialog from "./ServiceDialog";

const category = {
  id: "category-1",
  name: "Makeup",
  color: "category-blue",
  active: true,
  createdAt: "2026-08-27T00:00:00.000Z",
  updatedAt: "2026-08-27T00:00:00.000Z",
};

afterEach(cleanup);

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
});
