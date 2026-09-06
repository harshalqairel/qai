// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import ServiceTable from "./ServiceTable";
import { notify } from "@/lib/notifications";

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
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

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
        onActiveChange={() => true}
      />,
    );

    await user.click(screen.getByRole("link"));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Sort by Price, ascending" }));
    expect(onSortChange).toHaveBeenCalledWith("price-asc");
  });

  it("shows the state-specific action and confirms deactivation", async () => {
    const user = userEvent.setup();
    const onActiveChange = vi.fn(async () => true);
    render(
      <ServiceTable
        services={[service]}
        sort="newest"
        onSortChange={vi.fn()}
        getCategoryName={() => "Wedding"}
        getCategoryColor={() => "category-blue"}
        onEdit={vi.fn()}
        onDelete={() => true}
        onActiveChange={onActiveChange}
      />,
    );

    await user.click(screen.getAllByRole("button", { name: `Actions for ${service.name}` })[0]!);
    expect(screen.getByRole("menuitem", { name: "Deactivate service" })).not.toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Activate service" })).toBeNull();
    await user.click(screen.getByRole("menuitem", { name: "Deactivate service" }));
    expect(screen.getByRole("heading", { name: "Deactivate this service?" })).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Deactivate" }));

    expect(onActiveChange).toHaveBeenCalledWith(service, false);
  });

  it("activates an inactive service immediately and does not report false success", async () => {
    const user = userEvent.setup();
    const onActiveChange = vi.fn(async () => false);
    const success = vi.spyOn(notify, "success");
    const error = vi.spyOn(notify, "error");
    const inactive = { ...service, active: false };
    render(
      <ServiceTable
        services={[inactive]}
        sort="newest"
        onSortChange={vi.fn()}
        getCategoryName={() => "Wedding"}
        getCategoryColor={() => "category-blue"}
        onEdit={vi.fn()}
        onDelete={() => true}
        onActiveChange={onActiveChange}
      />,
    );

    expect(screen.getAllByText("Inactive").length).toBeGreaterThan(0);

    await user.click(screen.getAllByRole("button", { name: `Actions for ${inactive.name}` })[0]!);
    expect(screen.getByRole("menuitem", { name: "Activate service" })).not.toBeNull();
    await user.click(screen.getByRole("menuitem", { name: "Activate service" }));

    await vi.waitFor(() => expect(onActiveChange).toHaveBeenCalledWith(inactive, true));
    expect(success).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith("Could not activate the service. Try again.");
  });
});
