// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import QaiPageRenderer from "./QaiPageRenderer";
import { defaultQaiPage, QAI_PAGE_TEMPLATES } from "../validation";

const service = {
  serviceId: "service-1",
  visible: true,
  title: "Wedding Package",
  description: "Three-event makeup service.",
  price: 7_500_000,
  priceMode: "Fixed price" as const,
  actionMode: "Booking request" as const,
  durationMinutes: 120,
  defaultSessionCount: 3,
  locationPolicy: "Client can choose" as const,
  optionGroups: [],
  variants: [],
  position: 0,
  featured: false,
};

describe("QaiPageRenderer", () => {
  it.each(QAI_PAGE_TEMPLATES)("renders the %s layout without mutating operational services", async (template) => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    const page = { ...defaultQaiPage(), template, businessName: "Nuyi Studio", services: [service] };
    const before = structuredClone(page.services);
    const { container, unmount } = render(<QaiPageRenderer page={page} services={page.services} portfolio={[]} onChoose={onChoose} />);

    expect(container.querySelector(`[data-template="${template}"]`)).toBeTruthy();
    expect(screen.getAllByText("Nuyi Studio").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Powered by Qai" }).getAttribute("href")).toContain("utm_source=qai_page");
    await user.click(screen.getByRole("button", { name: "Request" }));
    expect(onChoose).toHaveBeenCalledWith(service, null);
    expect(page.services).toEqual(before);
    unmount();
  });

  it("selects only valid service option combinations and updates the public price and duration", async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    const serviceWithVariants = {
      ...service,
      title: "Korean Self Makeup Class",
      optionGroups: [
        { id: "instructor", name: "Instructor", position: 0, values: [
          { id: "owner", label: "Owner", active: true, position: 0 },
          { id: "mentor", label: "Mentor", active: true, position: 1 },
        ] },
        { id: "sessions", name: "Sessions", position: 1, values: [
          { id: "one", label: "1x", active: true, position: 0 },
          { id: "two", label: "2x", active: true, position: 1 },
        ] },
      ],
      variants: [
        { id: "owner-one", optionValueIds: ["owner", "one"], displayLabel: "Owner · 1 session", price: 2_100_000, duration: 120, defaultSessionCount: 1, active: true },
        { id: "mentor-two", optionValueIds: ["mentor", "two"], displayLabel: "Mentor · 2 sessions", price: 1_500_000, duration: 200, defaultSessionCount: 2, active: true },
      ],
    };
    const page = { ...defaultQaiPage(), services: [serviceWithVariants] };
    render(<QaiPageRenderer page={page} services={page.services} portfolio={[]} onChoose={onChoose} />);

    expect(screen.getByText("Rp 2.100.000")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Mentor" }));
    expect(screen.getByText("Rp 1.500.000")).toBeTruthy();
    expect(screen.getByText("3 hours 20 minutes")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Request" }));
    expect(onChoose).toHaveBeenCalledWith(serviceWithVariants, "mentor-two");
  });
});
