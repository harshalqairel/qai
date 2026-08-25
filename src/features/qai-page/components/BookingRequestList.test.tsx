// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PublicRequest } from "@/features/qai-page/validation";
import BookingRequestList from "./BookingRequestList";

const request: PublicRequest = {
  id: "9fabd108-f02f-4143-b24c-983107d3d61e",
  pageId: "page-1",
  slug: "atelier-luma",
  serviceId: "service-1",
  serviceName: "Portrait Session",
  type: "Booking request",
  clientName: "Alya",
  whatsapp: "081234567890",
  email: "",
  instagram: "",
  submissionId: "submission-1",
  clientId: null,
  serviceVariantId: null,
  serviceSnapshot: null,
  need: "",
  schedules: [{ id: "schedule-1", label: "", date: "2026-08-28", startTime: "09:00", endTime: "11:00", location: "Studio" }],
  location: "Studio",
  budget: "",
  questionnaireResponses: [],
  notes: "",
  status: "Pending",
  submittedAt: Date.UTC(2026, 7, 20, 8),
  updatedAt: Date.UTC(2026, 7, 20, 8),
  bookingId: null,
  instantSlotId: null,
};

afterEach(cleanup);

describe("BookingRequestList", () => {
  it("uses shared sortable headers and a single ordered row-action menu", async () => {
    const user = userEvent.setup();
    const onReview = vi.fn();
    render(<BookingRequestList requests={[request]} filter="Pending" onFilterChange={vi.fn()} onRefresh={vi.fn()} onAccept={vi.fn()} onReview={onReview} onDecline={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Sort by Submitted, ascending" })).toBeTruthy();
    expect(screen.queryByText(request.id)).toBeNull();
    const menus = screen.getAllByRole("button", { name: "Actions for Alya's request" });
    await user.click(menus[0]);
    expect(screen.getByRole("menuitem", { name: "Review & accept" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "WhatsApp" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Accept now" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Decline request" })).toBeTruthy();
    await user.click(screen.getByRole("menuitem", { name: "Review & accept" }));
    expect(onReview).toHaveBeenCalledWith(request);
  });
});
