// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import QaiPageRenderer from "./QaiPageRenderer";
import { defaultQaiPage, QAI_PAGE_TEMPLATES } from "../validation";

afterEach(cleanup);

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
    expect(container.querySelector("[data-qai-page-root]")?.className).toContain("w-full");
    expect(container.querySelector("[data-qai-page-root]")?.className).toContain("max-w-none");
    expect(screen.getAllByText("Nuyi Studio").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Powered by Qai" }).getAttribute("href")).toContain("utm_source=qai_page");
    await user.click(screen.getByRole("button", { name: "Open navigation menu" }));
    expect(screen.getAllByRole("button", { name: "Close navigation menu" })).toHaveLength(2);
    await user.click(screen.getAllByRole("button", { name: "Close navigation menu" })[0]);
    await user.click(screen.getByRole("button", { name: "Book this service" }));
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
    await user.click(screen.getByRole("button", { name: "Book this service" }));
    expect(onChoose).toHaveBeenCalledWith(serviceWithVariants, "mentor-two");
  });

  it("uses client-friendly booking language and reveals a safe-area mobile action after the hero", async () => {
    const onChoose = vi.fn();
    const page = { ...defaultQaiPage(), businessName: "Nuyi Studio", services: [service] };
    const { container } = render(<QaiPageRenderer page={page} services={page.services} portfolio={[]} onChoose={onChoose} />);
    expect(screen.queryByText(/^Request$/)).toBeNull();
    Object.defineProperty(window, "scrollY", { configurable: true, value: 700 });
    fireEvent.scroll(window);
    const thumbAction = await screen.findByText("Book now", { selector: "[data-qai-page-thumb-action] button" });
    expect(thumbAction).toBeTruthy();
    fireEvent.click(thumbAction);
    expect(onChoose).toHaveBeenCalledWith(service, null);
    expect(container.querySelector("[data-qai-page-root]")?.className).toContain("safe-area-inset-bottom");
  });

  it("opens a multi-image work gallery with navigation and a counter", async () => {
    const user = userEvent.setup();
    const page = { ...defaultQaiPage(), businessName: "Nuyi Studio" };
    const portfolio = [
      { id: "cover", workId: "work-1", workTitle: "Bridal story", imageUrl: "/cover.jpg", caption: "Cover", serviceId: null, visible: true, position: 0, isCover: true },
      { id: "detail", workId: "work-1", workTitle: "Bridal story", imageUrl: "/detail.jpg", caption: "Details", serviceId: null, visible: true, position: 1 },
    ];
    render(<QaiPageRenderer page={page} services={[]} portfolio={portfolio} />);

    await user.click(screen.getByRole("button", { name: "Open Bridal story gallery" }));
    expect(screen.getByRole("dialog", { name: "Bridal story gallery" })).toBeTruthy();
    expect(screen.getByText(/1 \/ 2/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Next image" }));
    expect(screen.getByText(/2 \/ 2/)).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Bridal story gallery" })).toBeNull();
  });

  it("renders normalized social profiles only when configured", () => {
    const page = { ...defaultQaiPage(), instagram: "@qai.studio", tiktok: "https://www.tiktok.com/@qai_video" };
    const { rerender } = render(<QaiPageRenderer page={page} services={[]} portfolio={[]} />);

    expect(screen.getByRole("link", { name: "Instagram" }).getAttribute("href")).toBe("https://www.instagram.com/qai.studio");
    expect(screen.getByRole("link", { name: "My business on TikTok" }).getAttribute("href")).toBe("https://www.tiktok.com/@qai_video");

    rerender(<QaiPageRenderer page={{ ...page, tiktok: "" }} services={[]} portfolio={[]} />);
    expect(screen.queryByRole("link", { name: "My business on TikTok" })).toBeNull();
  });
});
