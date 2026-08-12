// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import NeedsAttention from "./NeedsAttention";

describe("NeedsAttention", () => {
  it("shows only actionable work and exposes keyboard-safe links", async () => {
    const user = userEvent.setup();
    render(<NeedsAttention overdueCount={2} dueSoonCount={0} requestCount={1} todayCount={3} />);

    expect(screen.getByRole("heading", { name: "Needs attention" })).toBeTruthy();
    expect(screen.getByText("3 scheduled sessions today.")).toBeTruthy();
    expect(screen.queryByText("Payments due soon")).toBeNull();

    const overdue = screen.getByRole("link", { name: /Overdue payments/ });
    expect(overdue.getAttribute("href")).toBe("/bookings?payment=outstanding");
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("link", { name: /Add booking/ }));
  });

  it("uses a calm state when nothing needs attention", () => {
    render(<NeedsAttention overdueCount={0} dueSoonCount={0} requestCount={0} todayCount={0} />);

    expect(screen.getByRole("heading", { name: "You’re up to date" })).toBeTruthy();
    expect(screen.getByText("No scheduled sessions today.")).toBeTruthy();
  });
});
