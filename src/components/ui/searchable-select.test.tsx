// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SearchableSelect } from "./searchable-select";

afterEach(cleanup);

describe("SearchableSelect", () => {
  it("filters, supports keyboard selection, and exposes secondary identity", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SearchableSelect label="Client" value="" onValueChange={onChange} items={[
      { value: "a", label: "Sarah Kim", description: "+62 812 · @sarahkim", keywords: "sarah@example.com" },
      { value: "b", label: "Sarah Kim", description: "+62 811 · @sarahbeauty" },
    ]} />);
    await user.click(screen.getByRole("combobox", { name: "Client" }));
    const search = screen.getByRole("textbox", { name: "Search…" });
    await user.type(search, "sarah@example.com");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("a");
  });

  it("closes with Escape and renders an empty result", async () => {
    const user = userEvent.setup();
    render(<SearchableSelect label="Service" value="" onValueChange={() => undefined} items={[]} />);
    await user.click(screen.getByRole("combobox", { name: "Service" }));
    expect(screen.getByText("No matching options.")).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("keeps record creation inside the selector menu", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(<SearchableSelect label="Client" value="" onValueChange={() => undefined} items={[]} createAction={{ label: "Add new client", onSelect: onCreate }} />);
    await user.click(screen.getByRole("combobox", { name: "Client" }));
    await user.click(screen.getByRole("button", { name: "Add new client" }));
    expect(onCreate).toHaveBeenCalledOnce();
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("keeps a create action mounted through the iOS touch blur sequence", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(<SearchableSelect label="Client" value="" onValueChange={() => undefined} items={[]} createAction={{ label: "Add new client", onSelect: onCreate }} />);

    await user.click(screen.getByRole("combobox", { name: "Client" }));
    const search = screen.getByRole("textbox", { name: "Search…" });
    const create = screen.getByRole("button", { name: "Add new client" });

    fireEvent.pointerDown(create, { pointerId: 1, pointerType: "touch", isPrimary: true, button: 0 });
    fireEvent.blur(search, { relatedTarget: null });
    expect(screen.getByRole("button", { name: "Add new client" })).toBeTruthy();
    fireEvent.pointerUp(create, { pointerId: 1, pointerType: "touch", isPrimary: true, button: 0 });
    fireEvent.click(create);

    expect(onCreate).toHaveBeenCalledOnce();
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("selects an option through the iOS touch blur sequence", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SearchableSelect label="Service" value="" onValueChange={onChange} items={[{ value: "service-1", label: "Consultation" }]} />);

    await user.click(screen.getByRole("combobox", { name: "Service" }));
    const search = screen.getByRole("textbox", { name: "Search…" });
    const option = screen.getByRole("option", { name: "Consultation" });

    fireEvent.pointerDown(option, { pointerId: 1, pointerType: "touch", isPrimary: true, button: 0 });
    fireEvent.blur(search, { relatedTarget: null });
    fireEvent.pointerUp(option, { pointerId: 1, pointerType: "touch", isPrimary: true, button: 0 });
    fireEvent.click(option);

    expect(onChange).toHaveBeenCalledWith("service-1");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("still dismisses for outside pointer and focus interactions", async () => {
    const user = userEvent.setup();
    render(<div><SearchableSelect label="Client" value="" onValueChange={() => undefined} items={[]} /><button type="button">Outside</button></div>);

    await user.click(screen.getByRole("combobox", { name: "Client" }));
    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }), { pointerType: "touch", isPrimary: true, button: 0 });
    expect(screen.queryByRole("listbox")).toBeNull();

    await user.click(screen.getByRole("combobox", { name: "Client" }));
    fireEvent.blur(screen.getByRole("textbox", { name: "Search…" }), { relatedTarget: screen.getByRole("button", { name: "Outside" }) });
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
