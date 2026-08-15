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
};

describe("QaiPageRenderer", () => {
  it.each(QAI_PAGE_TEMPLATES)("renders the %s layout without mutating operational services", async (template) => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    const page = { ...defaultQaiPage(), template, businessName: "Nuyi Studio", services: [service] };
    const before = structuredClone(page.services);
    const { container, unmount } = render(<QaiPageRenderer page={page} services={page.services} portfolio={[]} onChoose={onChoose} />);

    expect(container.querySelector(`[data-template="${template}"]`)).toBeTruthy();
    expect(screen.getByText("Nuyi Studio")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Powered by Qai" }).getAttribute("href")).toContain("utm_source=qai_page");
    await user.click(screen.getByRole("button", { name: "Request" }));
    expect(onChoose).toHaveBeenCalledWith(service);
    expect(page.services).toEqual(before);
    unmount();
  });
});
