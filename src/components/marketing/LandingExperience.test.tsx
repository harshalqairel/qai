// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import LandingExperience from "./LandingExperience";

afterEach(cleanup);

describe("LandingExperience", () => {
  it("leads with one connected booking and the complete six-stage workflow", () => {
    render(<LandingExperience />);

    expect(screen.getByRole("heading", { level: 1, name: /One booking\. Everything connected\./ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Start with Qai/ }).getAttribute("href")).toBe("/dashboard");
    for (const stage of ["Request", "Booking", "Schedule", "Payment", "Invoice", "Report"]) {
      expect(screen.getAllByText(stage).length).toBeGreaterThan(0);
    }
  });

  it("explains that Qai Space feeds the owner workflow without unsupported social proof", () => {
    render(<LandingExperience />);

    expect(screen.getByRole("heading", { name: /public page is where the connected workflow begins/i })).toBeTruthy();
    expect(screen.getByText("New booking request")).toBeTruthy();
    expect(screen.queryByText(/loved by/i)).toBeNull();
  });
});
