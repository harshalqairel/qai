// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import DeleteAction from "@/components/system/DeleteAction";
import RowActionsMenu from "@/components/system/RowActionsMenu";

afterEach(cleanup);

function EditHarness({ onRowClick }: { onRowClick: () => void }) {
  const [open, setOpen] = useState(false);
  return <div onClick={onRowClick}>
    <RowActionsMenu recordLabel="Ayu" actions={[{ label: "Edit Ayu", icon: Pencil, onSelect: () => setOpen(true) }]} />
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent><DialogTitle>Edit Ayu</DialogTitle></DialogContent>
    </Dialog>
  </div>;
}

function DeleteHarness() {
  const [open, setOpen] = useState(false);
  return <>
    <RowActionsMenu recordLabel="Ayu" actions={[{ label: "Delete Ayu", icon: Trash2, destructive: true, onSelect: () => setOpen(true) }]} />
    <DeleteAction
      hideTrigger
      open={open}
      onOpenChange={setOpen}
      itemName="Ayu"
      onConfirm={() => true}
      successMessage="Deleted."
      errorMessage="Could not delete."
    />
  </>;
}

describe("RowActionsMenu overlay transitions", () => {
  it("opens a dialog from the portaled menu without activating its row", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(<EditHarness onRowClick={onRowClick} />);

    await user.click(screen.getByRole("button", { name: "Actions for Ayu" }));
    await user.click(screen.getByRole("menuitem", { name: "Edit Ayu" }));

    expect(screen.getByRole("dialog", { name: "Edit Ayu" })).toBeTruthy();
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("opens the confirmation for the retained record identity", async () => {
    const user = userEvent.setup();
    render(<DeleteHarness />);

    await user.click(screen.getByRole("button", { name: "Actions for Ayu" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete Ayu" }));

    expect(screen.getByRole("alertdialog", { name: "Delete Ayu?" })).toBeTruthy();
  });
});
