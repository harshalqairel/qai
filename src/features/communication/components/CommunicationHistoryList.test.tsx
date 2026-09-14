// @vitest-environment happy-dom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { listClientCommunications } = vi.hoisted(() => ({ listClientCommunications: vi.fn().mockResolvedValue([
  {
    id: "communication-1", businessId: "business-1", customerId: "customer-1", bookingId: "booking-1", actorUserId: "user-1",
    channel: "whatsapp", templateType: "overdue_reminder", actionStatus: "whatsapp_opened", recipientSnapshot: "081234567890",
    subject: null, bodySnapshot: "Hi Ayu", providerReference: null, metadata: {}, createdAt: "2026-09-14T02:00:00.000Z", openedAt: "2026-09-14T02:00:00.000Z",
  },
]) }));
vi.mock("../communicationRepository", () => ({ listClientCommunications }));

import CommunicationHistoryList from "./CommunicationHistoryList";

afterEach(cleanup);

describe("CommunicationHistoryList", () => {
  it("loads booking history and never labels an external draft as sent", async () => {
    render(<CommunicationHistoryList bookingId="booking-1" />);
    await waitFor(() => expect(screen.getByText("Opened in WhatsApp")).toBeTruthy());
    expect(listClientCommunications).toHaveBeenCalledWith({ bookingId: "booking-1", customerId: undefined });
    expect(screen.queryByText(/^Sent$/)).toBeNull();
  });
});
