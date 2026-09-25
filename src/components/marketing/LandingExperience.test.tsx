// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import LandingExperience from "./LandingExperience";

afterEach(cleanup);

describe("LandingExperience", () => {
  it("leads with the real product, new wordmark, and a direct booking story", () => {
    render(<LandingExperience />);

    expect(screen.getByRole("heading", { level: 1, name: "From booking to payment, everything stays connected." })).toBeTruthy();
    expect(screen.getByRole("img", { name: /Qai dashboard showing today's schedule/i })).toBeTruthy();
    expect(screen.getAllByRole("img", { name: "Qai" })).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "Keep the whole job connected." })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Your schedule follows the work." })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "One booking. Everything connected." })).toBeNull();
    expect(screen.getAllByRole("link", { name: "Start free" }).some((link) => link.getAttribute("href") === "/dashboard")).toBe(true);
  });

  it("shows product proof, Qai Space, and honest access copy without demo provenance", () => {
    render(<LandingExperience />);

    expect(screen.getByRole("img", { name: /Qai bookings with scheduled jobs/i })).toBeTruthy();
    expect(screen.getByRole("img", { name: /monthly calendar showing/i })).toBeTruthy();
    expect(screen.getByRole("img", { name: /grand total, paid amount, and balance due/i })).toBeTruthy();
    expect(screen.getByRole("img", { name: /financial reports/i })).toBeTruthy();
    expect(screen.getByRole("img", { name: /Luma Studio Qai Space/i })).toBeTruthy();
    expect(screen.getByText(/photographers, studios, tutors, consultants/i)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Start free." })).toBeTruthy();
    expect(screen.queryByText(/fictional example|made with Qai Space/i)).toBeNull();
    expect(screen.queryByText(/trusted by|unlimited|free trial/i)).toBeNull();
  });

  it("opens, closes, and keyboard-dismisses the mobile menu", () => {
    render(<LandingExperience />);
    const openButton = screen.getByRole("button", { name: "Open menu" });
    fireEvent.click(openButton);
    expect(screen.getByRole("navigation", { name: "Mobile navigation" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close menu" }).getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(screen.getByRole("navigation", { name: "Mobile navigation" }), { key: "Escape" });
    expect(screen.queryByRole("navigation", { name: "Mobile navigation" })).toBeNull();
    expect(screen.getByRole("button", { name: "Open menu" }).getAttribute("aria-expanded")).toBe("false");
  });
});
