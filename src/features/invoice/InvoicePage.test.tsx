// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  NewInvoiceFlowDialog,
  type NewInvoiceBookingOption,
  type NewInvoiceFlow,
} from "./InvoicePage";

afterEach(cleanup);

const bookings: NewInvoiceBookingOption[] = [{
  id: "booking-1",
  customerName: "Sarah Wijaya",
  serviceName: "Wedding Package",
  sessionCount: 2,
  servicePrice: 7_500_000,
}];

function FlowHarness({ onSelect = () => undefined, onCreateFromScratch = () => undefined }: {
  onSelect?: (bookingId: string) => void;
  onCreateFromScratch?: () => void;
}) {
  const [flow, setFlow] = useState<NewInvoiceFlow>("closed");
  return <>
    <button type="button" onClick={() => setFlow("choose-source")}>New invoice</button>
    <NewInvoiceFlowDialog
      flow={flow}
      bookings={bookings}
      onFlowChange={setFlow}
      onSelectBooking={(bookingId) => {
        onSelect(bookingId);
        setFlow("closed");
      }}
      onCreateFromScratch={() => {
        onCreateFromScratch();
        setFlow("closed");
      }}
    />
  </>;
}

describe("new invoice flow", () => {
  it("transitions from source selection to booking selection without stacking dialogs", async () => {
    const user = userEvent.setup();
    render(<FlowHarness />);

    await user.click(screen.getByRole("button", { name: "New invoice" }));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog", { name: "New invoice" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /From a booking/ }));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog", { name: "Choose a booking" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /From a booking/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Sarah Wijaya/ }).textContent).toContain("Rp 7.500.000");
  });

  it("selects the correct booking with keyboard interaction and closes the flow", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<FlowHarness onSelect={onSelect} />);

    await user.click(screen.getByRole("button", { name: "New invoice" }));
    await user.click(screen.getByRole("button", { name: /From a booking/ }));
    screen.getByRole("button", { name: /Sarah Wijaya/ }).focus();
    await user.keyboard("{Enter}");

    expect(onSelect).toHaveBeenCalledWith("booking-1");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("supports Back, From scratch, and Close without leaving a second layer open", async () => {
    const onCreateFromScratch = vi.fn();
    const user = userEvent.setup();
    render(<FlowHarness onCreateFromScratch={onCreateFromScratch} />);

    await user.click(screen.getByRole("button", { name: "New invoice" }));
    await user.click(screen.getByRole("button", { name: /From a booking/ }));
    await user.click(screen.getByRole("button", { name: /Back/ }));
    expect(screen.getByRole("dialog", { name: "New invoice" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /From scratch/ }));
    expect(onCreateFromScratch).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(screen.getByRole("button", { name: "New invoice" }));
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
