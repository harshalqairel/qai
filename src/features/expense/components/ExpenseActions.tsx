"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import DeleteAction from "@/components/system/DeleteAction";
import RowActionsMenu from "@/components/system/RowActionsMenu";
import type { Expense } from "@/features/expense/types";

type ExpenseActionsProps = {
  expense: Expense;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => boolean | Promise<boolean>;
};

export default function ExpenseActions({ expense, onEdit, onDelete }: ExpenseActionsProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <RowActionsMenu
        recordLabel={`expense on ${expense.date}`}
        actions={[
          { label: "View or edit", icon: Pencil, onSelect: () => onEdit(expense) },
          { label: "Delete expense", icon: Trash2, onSelect: () => setDeleteOpen(true), destructive: true, separatorBefore: true },
        ]}
      />
      <DeleteAction
        itemName="this expense"
        onConfirm={() => onDelete(expense)}
        successMessage="Expense deleted."
        errorMessage="Could not delete the expense. Try again."
        confirmLabel="Delete expense"
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        hideTrigger
      />
    </>
  );
}
