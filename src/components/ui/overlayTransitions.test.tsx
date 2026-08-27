// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

afterEach(cleanup);

function NestedDialogHarness() {
  const [childOpen, setChildOpen] = useState(false);
  return <Dialog open>
    <DialogContent>
      <DialogTitle>Parent dialog</DialogTitle>
      <Button onClick={() => setChildOpen(true)}>Open child</Button>
      <Dialog open={childOpen} onOpenChange={setChildOpen}>
        <DialogContent><DialogTitle>Child dialog</DialogTitle></DialogContent>
      </Dialog>
    </DialogContent>
  </Dialog>;
}

function DialogSelectHarness() {
  const [value, setValue] = useState("one");
  return <Dialog open>
    <DialogContent>
      <DialogTitle>Schedule settings</DialogTitle>
      <Select value={value} onValueChange={(next) => setValue(next ?? "one")}>
        <SelectTrigger aria-label="Schedule time"><SelectValue>{value === "one" ? "10:00" : "15:00"}</SelectValue></SelectTrigger>
        <SelectContent><SelectItem value="one">10:00</SelectItem><SelectItem value="two">15:00</SelectItem></SelectContent>
      </Select>
    </DialogContent>
  </Dialog>;
}

describe("shared overlay transitions", () => {
  it("closes the topmost nested dialog first with Escape", async () => {
    const user = userEvent.setup();
    render(<NestedDialogHarness />);
    await user.click(screen.getByRole("button", { name: "Open child" }));
    expect(screen.getByRole("dialog", { name: "Child dialog" })).toBeTruthy();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Child dialog" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "Parent dialog" })).toBeTruthy();
  });

  it("selects a portaled option inside a dialog without dismissing its parent", async () => {
    const user = userEvent.setup();
    render(<DialogSelectHarness />);
    await user.click(screen.getByRole("combobox", { name: "Schedule time" }));
    await user.click(screen.getByRole("option", { name: "15:00" }));

    expect(screen.getByRole("combobox", { name: "Schedule time" }).textContent).toContain("15:00");
    expect(screen.getByRole("dialog", { name: "Schedule settings" })).toBeTruthy();
  });
});
