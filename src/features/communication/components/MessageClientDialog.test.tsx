// @vitest-environment happy-dom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CommunicationContext } from "../types";

const { recordClientCommunication } = vi.hoisted(() => ({ recordClientCommunication: vi.fn().mockResolvedValue({}) }));
vi.mock("../communicationRepository", () => ({ recordClientCommunication }));

import MessageClientDialog from "./MessageClientDialog";

const context: CommunicationContext = {
  customerId: "customer-1", bookingId: "booking-1", customerName: "Ayu", customerPhone: "081234567890",
  customerEmail: "ayu@example.com", businessName: "Qai Studio", serviceName: "Portrait", bookingDate: "20 Sep 2026",
  dueDate: "18 Sep 2026", bookingValue: 1_500_000, totalPaid: 500_000, remainingAmount: 1_000_000,
};

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("MessageClientDialog", () => {
  it("opens WhatsApp and records only the truthful opened action", async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const onClose = vi.fn();
    render(<MessageClientDialog open context={context} defaultTemplate="overdue_reminder" onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "Open WhatsApp" }));
    await waitFor(() => expect(recordClientCommunication).toHaveBeenCalled());
    expect(open.mock.calls[0][0]).toMatch(/^https:\/\/wa\.me\/6281234567890\?text=/);
    expect(recordClientCommunication).toHaveBeenCalledWith(expect.objectContaining({
      channel: "whatsapp",
      actionStatus: "whatsapp_opened",
      templateType: "overdue_reminder",
    }));
    expect(JSON.stringify(recordClientCommunication.mock.calls)).not.toContain("sent");
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps the external action unavailable when contact data is invalid", () => {
    render(<MessageClientDialog open context={{ ...context, customerPhone: "123", customerEmail: "" }} defaultTemplate="appointment_reminder" onClose={() => undefined} />);
    expect(screen.getByRole("button", { name: "Open WhatsApp" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("A valid client phone number and message are required.")).toBeTruthy();
  });

  it("selects email for an email-only client and records a draft-opened action", async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<MessageClientDialog open context={{ ...context, customerPhone: "" }} defaultTemplate="payment_reminder" onClose={() => undefined} />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Open email draft" })).toBeTruthy());
    await user.click(screen.getByRole("button", { name: "Open email draft" }));
    await waitFor(() => expect(recordClientCommunication).toHaveBeenCalledWith(expect.objectContaining({
      channel: "email",
      actionStatus: "email_draft_opened",
    })));
    expect(open.mock.calls[0][0]).toMatch(/^mailto:ayu%40example\.com\?/);
  });

  it("preserves an edited message across equivalent parent rerenders", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<MessageClientDialog open context={{ ...context }} defaultTemplate="appointment_reminder" onClose={() => undefined} />);
    const message = screen.getByLabelText("Message") as HTMLTextAreaElement;
    await user.clear(message);
    await user.type(message, "A carefully edited draft");
    rerender(<MessageClientDialog open context={{ ...context }} defaultTemplate="appointment_reminder" onClose={() => undefined} />);
    expect((screen.getByLabelText("Message") as HTMLTextAreaElement).value).toBe("A carefully edited draft");
  });
});
