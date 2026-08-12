// @vitest-environment happy-dom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";
import FounderLogin from "@/components/validation/FounderLogin";
import FounderManager from "@/components/validation/FounderManager";
import ValidationAccess from "@/components/validation/ValidationAccess";
import BookingHeader from "@/features/booking/components/BookingHeader";
import CustomerHeader from "@/features/customer/components/CustomerHeader";
import ExpenseHeader from "@/features/expense/components/ExpenseHeader";
import ServiceHeader from "@/features/service/components/ServiceHeader";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function clickAction(label: string, renderAction: (onClick: () => void) => React.ReactNode) {
  const onClick = vi.fn();
  const user = userEvent.setup();
  render(renderAction(onClick));
  await user.click(screen.getByRole("button", { name: label }));
  expect(onClick).toHaveBeenCalledTimes(1);
}

describe("pointer interaction reliability", () => {
  it("submits validation access from a pointer click", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Invalid" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ValidationAccess />);

    await user.type(screen.getByLabelText("Test code"), "TEST-1234");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" });
  });

  it("submits founder login from a pointer click", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Invalid" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<FounderLogin />);

    await user.type(screen.getByLabelText("Founder credential"), "invalid-test-value");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" });
  });

  it("creates a founder workspace from a single pointer click", async () => {
    const workspace = {
      id: "workspace-1",
      label: "Pointer Test",
      public_slug: "pointer-test",
      status: "active",
      created_at: "2026-08-12T00:00:00.000Z",
      last_access_at: null,
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { workspace, code: "TEST-1234", inviteUrl: "https://example.test/invite" },
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<FounderManager />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await user.type(screen.getByLabelText("Tester or business name"), "Pointer Test");
    await user.click(screen.getByRole("button", { name: "Create workspace" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "POST" });
  });

  it("opens Add Client once from pointer input", async () => {
    await clickAction("+ Add client", (onClick) => <CustomerHeader onAdd={onClick} />);
  });

  it("opens Add Service once from pointer input", async () => {
    await clickAction("+ Add service", (onClick) => <ServiceHeader onAdd={onClick} />);
  });

  it("opens Add Booking once from pointer input", async () => {
    await clickAction("+ Add booking", (onClick) => <BookingHeader onAdd={onClick} />);
  });

  it("opens Add Expense once from pointer input", async () => {
    await clickAction("+ Add expense", (onClick) => <ExpenseHeader onAdd={onClick} />);
  });

  it("opens Add Payment once through the shared button", async () => {
    await clickAction("Add Payment", (onClick) => <Button onClick={onClick}>Add Payment</Button>);
  });

  it("opens an invoice action once through the shared button", async () => {
    await clickAction("New invoice", (onClick) => <Button onClick={onClick}>New invoice</Button>);
  });

  it("runs a Qai Page action once through the shared button", async () => {
    await clickAction("Save page", (onClick) => <Button onClick={onClick}>Save page</Button>);
  });

  it("does not activate a disabled shared button", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button disabled onClick={onClick}>Disabled action</Button>);
    await user.click(screen.getByRole("button", { name: "Disabled action" }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
