// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Booking } from "@/features/booking/types";
import type { BookingFormValues } from "@/features/booking/schema";
import type { Customer } from "@/features/customer/types";
import type { Payment } from "@/features/payment/types";
import type { Service } from "@/features/service/types";
import { BookingSaveError } from "@/features/booking/domain/bookingSaveError";
import BookingDialog from "./BookingDialog";

const notificationMocks = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/lib/notifications", () => ({ notify: notificationMocks }));

const client: Customer = { id: "client-1", name: "Alya", phone: "0812", instagram: "@alya", email: "", notes: "", createdAt: 1 };
const createdClient: Customer = { id: "client-2", name: "Nadia", phone: "0813", instagram: "", email: "", notes: "", createdAt: 2 };
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
  vi.clearAllMocks();
  window.localStorage.clear();
});

function renderDialog(payments: Payment[] = [], quickCreate = false) {
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
    onQuickCreateCustomer={quickCreate ? vi.fn(async () => createdClient) : undefined}
    onQuickCreateService={quickCreate ? vi.fn(async () => newService) : undefined}
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
  it("keeps actions outside the single scrollable form body", () => {
    renderDialog();
    const form = document.querySelector("#booking-details-form");
    const save = screen.getByRole("button", { name: "Save changes" });
    expect(form?.className).toContain("overflow-y-auto");
    expect(save.closest("form")).toBeNull();
    expect(save.getAttribute("form")).toBe("booking-details-form");
  });

  it("keeps the pricing rail in normal document flow so later financial sections cannot scroll beneath it", () => {
    renderDialog();
    const pricingRail = screen.getByRole("heading", { name: "Pricing & status" }).closest("aside");
    expect(pricingRail).not.toBeNull();
    expect(pricingRail?.className).not.toContain("sticky");
    expect(pricingRail?.className).toContain("lg:self-start");
    expect(screen.getByRole("heading", { name: "Booking Profit" })).toBeTruthy();
  });

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

  it("shows the sanitized cloud save reason returned by the throwing save path", async () => {
    const user = userEvent.setup();
    const onUpdate = renderDialog();
    onUpdate.mockRejectedValueOnce(new BookingSaveError(
      "The Additional Charge category could not be saved.",
      { operation: "save_booking_with_integrity", code: "22P02", status: 400 },
    ));

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(notificationMocks.error).toHaveBeenCalledWith(
      "Could not save the booking: The Additional Charge category could not be saved.",
    ));
  });

  it("opens inline client creation after the iOS touch blur sequence", async () => {
    const user = userEvent.setup();
    renderDialog([], true);
    await user.click(screen.getByRole("combobox", { name: "Client" }));
    const search = screen.getByRole("textbox", { name: /Search name/ });
    const create = screen.getByRole("button", { name: "Add new client" });

    fireEvent.pointerDown(create, { pointerId: 1, pointerType: "touch", isPrimary: true, button: 0 });
    fireEvent.blur(search, { relatedTarget: null });
    fireEvent.pointerUp(create, { pointerId: 1, pointerType: "touch", isPrimary: true, button: 0 });
    fireEvent.click(create);

    expect(screen.getByLabelText("Client name")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Edit booking" })).toBeTruthy();
  });

  it("opens inline service creation after the iOS touch blur sequence", async () => {
    const user = userEvent.setup();
    renderDialog([], true);
    await user.click(screen.getByRole("combobox", { name: "Service" }));
    const search = screen.getByRole("textbox", { name: /Search service/ });
    const create = screen.getByRole("button", { name: "Add new service" });

    fireEvent.pointerDown(create, { pointerId: 1, pointerType: "touch", isPrimary: true, button: 0 });
    fireEvent.blur(search, { relatedTarget: null });
    fireEvent.pointerUp(create, { pointerId: 1, pointerType: "touch", isPrimary: true, button: 0 });
    fireEvent.click(create);

    expect(screen.getByLabelText("Service name")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Edit booking" })).toBeTruthy();
  });

  it("creates and selects a client without losing the booking form state", async () => {
    const user = userEvent.setup();
    const onUpdate = renderDialog([], true);
    await user.click(screen.getByRole("combobox", { name: "Client" }));
    const search = screen.getByRole("textbox", { name: /Search name/ });
    const create = screen.getByRole("button", { name: "Add new client" });
    fireEvent.pointerDown(create, { pointerId: 1, pointerType: "touch", isPrimary: true, button: 0 });
    fireEvent.blur(search, { relatedTarget: null });
    fireEvent.pointerUp(create, { pointerId: 1, pointerType: "touch", isPrimary: true, button: 0 });
    fireEvent.click(create);

    await user.type(screen.getByLabelText("Client name"), createdClient.name);
    await user.type(screen.getByLabelText("Phone"), createdClient.phone);
    await user.click(screen.getByRole("button", { name: "Add and select" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledOnce());
    expect(onUpdate.mock.calls[0]![0]).toMatchObject({
      customerId: createdClient.id,
      serviceId: oldService.id,
      notes: "Keep notes",
      sessions: [{ id: "session-1", label: "Main", date: "2026-09-12", startTime: "09:00", endTime: "11:00", location: "Studio", notes: "Keep" }],
    });
  });

  it("cancels inline creation and Escape closes only the selector", async () => {
    const user = userEvent.setup();
    renderDialog([], true);
    await user.click(screen.getByRole("combobox", { name: "Client" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("dialog", { name: "Edit booking" })).toBeTruthy();

    await user.click(screen.getByRole("combobox", { name: "Client" }));
    await user.click(screen.getByRole("button", { name: "Add new client" }));
    const nameInput = screen.getByLabelText("Client name");
    const quickPanel = nameInput.parentElement?.parentElement;
    expect(quickPanel).toBeTruthy();
    await user.click(quickPanel!.querySelectorAll("button")[1]!);

    expect(screen.queryByLabelText("Client name")).toBeNull();
    expect(screen.getByRole("dialog", { name: "Edit booking" })).toBeTruthy();
  });
});
