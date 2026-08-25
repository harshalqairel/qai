// @vitest-environment happy-dom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Booking } from "@/features/booking/types";
import type { BookingFormValues } from "@/features/booking/schema";
import type { Customer } from "@/features/customer/types";
import type { Payment } from "@/features/payment/types";
import type { Service } from "@/features/service/types";
import BookingDialog from "./BookingDialog";

const client: Customer = { id: "client-1", name: "Alya", phone: "0812", instagram: "@alya", email: "", notes: "", createdAt: 1 };
const oldService: Service = { id: "service-old", name: "Old service", categoryId: "category", price: 2_500_000, duration: 120, defaultSessionCount: 1, description: "", active: true };
const newService: Service = { id: "service-new", name: "New service", categoryId: "category", price: 1_500_000, duration: 60, defaultSessionCount: 1, description: "", active: true };
const booking: Booking = {
  id: "booking-1",
  customerId: client.id,
  serviceId: oldService.id,
  serviceSnapshot: {
    serviceName: oldService.name,
    variantId: "old-variant",
    variantLabel: "Old option",
    options: [{ groupId: "old-group", groupName: "Package", valueId: "old-value", valueLabel: "Old" }],
    price: oldService.price,
    duration: oldService.duration,
    defaultSessionCount: 1,
  },
  sessions: [{ id: "session-1", bookingId: "booking-1", sequence: 1, label: "Main", startAt: "2026-09-12T02:00:00.000Z", endAt: "2026-09-12T04:00:00.000Z", location: "Studio", notes: "Keep", createdAt: 1, updatedAt: 1 }],
  servicePrice: oldService.price,
  additionalCharges: [],
  questionnaireResponses: [],
  capacitySourceRequestId: null,
  capacitySlotKeys: [],
  bookingStatus: "Scheduled",
  fullPaymentDueDate: "2026-09-05",
  notes: "Keep notes",
  createdAt: 1,
  updatedAt: 1,
};

const payment: Payment = { id: "payment-1", bookingId: booking.id, date: "2026-08-25", amount: 500_000, method: "Bank Transfer", notes: "Deposit", createdAt: 1 };

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function renderDialog(payments: Payment[] = []) {
  const onUpdate = vi.fn<(input: BookingFormValues & { id: string }) => Promise<boolean>>();
  onUpdate.mockResolvedValue(true);
  render(<BookingDialog
    open
    booking={booking}
    customers={[client]}
    services={[oldService, newService]}
    payments={payments}
    expenses={[]}
    timezone="Asia/Jakarta"
    onClose={vi.fn()}
    onCreate={vi.fn(async () => true)}
    onUpdate={onUpdate}
    onAddPaymentClick={vi.fn()}
    onEditPaymentClick={vi.fn()}
    onDeletePayment={vi.fn(async () => true)}
  />);
  return onUpdate;
}

async function chooseNewService(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("combobox", { name: "Service" }));
  await user.click(screen.getByRole("option", { name: /New service/ }));
}

describe("BookingDialog service changes", () => {
  it("changes an existing service, clears the old option snapshot, and preserves schedules", async () => {
    const user = userEvent.setup();
    const onUpdate = renderDialog();
    await chooseNewService(user);
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledOnce());
    const update = onUpdate.mock.calls[0]![0];
    expect(update.serviceId).toBe(newService.id);
    expect(update.serviceSnapshot).toMatchObject({ serviceName: "New service", variantId: null, options: [] });
    expect(update.servicePrice).toBe(newService.price);
    expect(update.sessions).toEqual([{ id: "session-1", label: "Main", date: "2026-09-12", startTime: "09:00", endTime: "11:00", location: "Studio", notes: "Keep" }]);
  });

  it("keeps the current booking amount when payment history exists", async () => {
    const user = userEvent.setup();
    const onUpdate = renderDialog([payment]);
    await chooseNewService(user);
    expect((screen.getByRole("radio", { name: /Keep current amount/ }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText(/Payments and invoice records stay unchanged/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledOnce());
    expect(onUpdate.mock.calls[0]![0].servicePrice).toBe(booking.servicePrice);
  });
});
