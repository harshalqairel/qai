// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/config", () => ({
  isCloudModeEnabled: () => false,
  isValidationModeEnabled: () => false,
}));

import { listClientCommunications, recordClientCommunication } from "./communicationRepository";
import { clientCommunicationSchema } from "./types";

describe("client communication repository", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("persists truthful opened actions across repository reloads", async () => {
    await recordClientCommunication({
      customerId: "customer-1", bookingId: "booking-1", channel: "whatsapp", templateType: "overdue_reminder",
      actionStatus: "whatsapp_opened", recipientSnapshot: "081234567890", bodySnapshot: "Hi Ayu",
    });
    const records = await listClientCommunications({ bookingId: "booking-1" });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ actionStatus: "whatsapp_opened", channel: "whatsapp", bodySnapshot: "Hi Ayu" });
    expect(JSON.stringify(records)).not.toContain('"sent"');
  });

  it("records email drafts without claiming delivery", async () => {
    await recordClientCommunication({
      customerId: "customer-1", channel: "email", templateType: "blank", actionStatus: "email_draft_opened",
      recipientSnapshot: "ayu@example.com", subject: "Hello", bodySnapshot: "Hi Ayu",
    });
    expect((await listClientCommunications({ customerId: "customer-1" }))[0].actionStatus).toBe("email_draft_opened");
  });

  it("rejects a status that does not match the channel", async () => {
    await expect(recordClientCommunication({
      customerId: "customer-1", channel: "email", templateType: "blank", actionStatus: "whatsapp_opened",
      recipientSnapshot: "ayu@example.com", bodySnapshot: "Hi",
    })).rejects.toThrow("does not match");
  });

  it("accepts PostgreSQL timestamptz values returned by cloud communication reads", () => {
    expect(clientCommunicationSchema.parse({
      id: "communication-1",
      businessId: "business-1",
      customerId: "customer-1",
      bookingId: "booking-1",
      actorUserId: "user-1",
      channel: "whatsapp",
      templateType: "overdue_reminder",
      actionStatus: "whatsapp_opened",
      recipientSnapshot: "081234567890",
      subject: null,
      bodySnapshot: "Hi Ayu",
      providerReference: null,
      metadata: {},
      createdAt: "2026-09-15T06:50:17.548193+00:00",
      openedAt: "2026-09-15T06:50:17.679+00:00",
    })).toMatchObject({ id: "communication-1" });
  });
});
