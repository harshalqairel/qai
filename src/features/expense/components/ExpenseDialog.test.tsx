// @vitest-environment happy-dom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import ExpenseDialog from "./ExpenseDialog";

afterEach(cleanup);

describe("ExpenseDialog", () => {
  it("only asks for a booking when the expense belongs to a specific booking", async () => {
    const user = userEvent.setup();
    render(
      <ExpenseDialog
        open
        expense={null}
        bookingOptions={[{ id: "booking-1", label: "Ayu · Wedding" }]}
        categories={[
          {
            id: "category-1",
            name: "Transport",
            color: "category-blue",
            active: true,
            createdAt: "2026-08-14T00:00:00.000Z",
            updatedAt: "2026-08-14T00:00:00.000Z",
          },
        ]}
        onClose={vi.fn()}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
      />,
    );

    expect(screen.queryByText("Booking", { selector: "label" })).toBeNull();

    await user.click(screen.getByRole("button", { name: /Specific booking/ }));
    expect(screen.getByText("Booking", { selector: "label" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /General business/ }));
    expect(screen.queryByText("Booking", { selector: "label" })).toBeNull();
  });

  it("creates an expense category inline without closing the parent dialog", async () => {
    const user = userEvent.setup();
    const onQuickCreateCategory = vi.fn(async () => ({
      id: "category-2",
      name: "Parking",
      color: "category-blue",
      active: true,
      createdAt: "2026-08-27T00:00:00.000Z",
      updatedAt: "2026-08-27T00:00:00.000Z",
    }));
    render(
      <ExpenseDialog
        open
        expense={null}
        bookingOptions={[]}
        categories={[{
          id: "category-1",
          name: "Transport",
          color: "category-blue",
          active: true,
          createdAt: "2026-08-14T00:00:00.000Z",
          updatedAt: "2026-08-14T00:00:00.000Z",
        }]}
        onClose={vi.fn()}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onQuickCreateCategory={onQuickCreateCategory}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Add category" }));
    await user.type(screen.getByLabelText("New category"), "Parking");
    await user.click(screen.getByRole("button", { name: "Add Category" }));

    await waitFor(() => expect(onQuickCreateCategory).toHaveBeenCalledWith("Parking"));
    expect(screen.queryByLabelText("New category")).toBeNull();
    expect(screen.getByRole("heading", { name: "Add Expense" })).toBeTruthy();
  });
});
