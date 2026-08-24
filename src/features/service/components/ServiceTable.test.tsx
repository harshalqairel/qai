// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ServiceTable from "./ServiceTable";

const service = {
  id: "service-1",
  name: "Akad Only",
  categoryId: "category-1",
  price: 6_500_000,
  duration: 180,
  defaultSessionCount: 1,
  description: "Wedding ceremony makeup.",
  active: true,
};

describe("ServiceTable", () => {
  it("opens a service from a real pointer click and supports sortable headers", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onSortChange = vi.fn();
    render(
      <ServiceTable
        services={[service]}
        sort="newest"
        onSortChange={onSortChange}
        getCategoryName={() => "Wedding"}
        getCategoryColor={() => "category-blue"}
        onEdit={onEdit}
        onDelete={() => true}
      />,
    );

    await user.click(screen.getByRole("link"));
    expect(onEdit).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Sort by Price, ascending" }));
    expect(onSortChange).toHaveBeenCalledWith("price-asc");
  });
});
