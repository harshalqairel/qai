// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ExpenseDialog from "./ExpenseDialog";

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
});
