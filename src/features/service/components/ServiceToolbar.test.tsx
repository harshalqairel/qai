// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import ServiceToolbar from "./ServiceToolbar";

afterEach(cleanup);

describe("ServiceToolbar", () => {
  it("exposes the All, Active, and Inactive status filter", async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn();
    render(
      <ServiceToolbar
        search=""
        onSearchChange={vi.fn()}
        category=""
        onCategoryChange={vi.fn()}
        status="all"
        onStatusChange={onStatusChange}
        sort="newest"
        onSortChange={vi.fn()}
        categories={[]}
      />,
    );

    const status = screen.getByRole("combobox", { name: "Filter services by status" });
    expect(Array.from(status.querySelectorAll("option")).map((option) => option.textContent)).toEqual(["All", "Active", "Inactive"]);
    await user.selectOptions(status, "inactive");
    expect(onStatusChange).toHaveBeenCalledWith("inactive");
  });
});
