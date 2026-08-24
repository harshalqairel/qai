// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import NeedsAttention from "./NeedsAttention";

describe("NeedsAttention", () => {
  it("shows only actionable work and exposes direct links", () => {
    const { unmount } = render(<NeedsAttention overdueCount={2} overdueAmount={4_500_000} requestCount={1} />);

    expect(screen.getByRole("heading", { name: "Needs attention" })).toBeTruthy();
    expect(screen.getByText("2 bookings · Rp 4.500.000")).toBeTruthy();

    const overdue = screen.getByRole("link", { name: /Overdue payments/ });
    expect(overdue.getAttribute("href")).toBe("/bookings?payment=outstanding");
    expect(screen.getByRole("link", { name: /Booking requests/ }).getAttribute("href")).toBe("/qai-page?tab=Requests");
    unmount();
  });

  it("uses a calm state when nothing needs attention", () => {
    const { unmount } = render(<NeedsAttention overdueCount={0} overdueAmount={0} requestCount={0} />);

    expect(screen.getByRole("heading", { name: "Needs attention" })).toBeTruthy();
    expect(screen.getByText("You’re up to date.")).toBeTruthy();
    unmount();
  });
});
