"use client";

import { useMemo, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORY_COLORS, DEFAULT_CATEGORY_COLOR } from "../constants";
import { normalizeCategoryName } from "../utils";
import type { BaseCategory, CategoryInput } from "../types";
import DataErrorState from "@/components/system/DataErrorState";
import { notify } from "@/lib/notifications";

type CategoryManagerProps<T extends BaseCategory> = {
  title: string;
  description: string;
  recordName: "service" | "expense";
  categories: T[];
  usageCounts: Record<string, number>;
  onCreate: (input: CategoryInput) => void | Promise<void>;
  onUpdate: (id: string, input: CategoryInput) => void | Promise<void>;
  onSetActive: (id: string, active: boolean) => void | Promise<void>;
  onDelete: (id: string, replacementId?: string) => void | Promise<void>;
  loadError?: string;
  onRetry: () => void;
};

export default function CategoryManager<T extends BaseCategory>({
  title,
  description,
  recordName,
  categories,
  usageCounts,
  onCreate,
  onUpdate,
  onSetActive,
  onDelete,
  loadError,
  onRetry,
}: CategoryManagerProps<T>) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(DEFAULT_CATEGORY_COLOR);
  const [nameError, setNameError] = useState("");
  const [actionError, setActionError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<T | null>(null);
  const [replacementId, setReplacementId] = useState("");
  const [pendingAction, setPendingAction] = useState<{
    kind: "saving" | "hiding" | "showing" | "deleting" | "moving";
    categoryId?: string;
  } | null>(null);
  const actionLocked = useRef(false);

  const usageCount = deleteTarget ? usageCounts[deleteTarget.id] ?? 0 : 0;
  const replacements = useMemo(
    () => categories.filter((category) => category.active && category.id !== deleteTarget?.id),
    [categories, deleteTarget],
  );

  function openCreate() {
    setEditing(null);
    setName("");
    setColor(DEFAULT_CATEGORY_COLOR);
    setNameError("");
    setActionError("");
    setFormOpen(true);
  }

  function openEdit(category: T) {
    setEditing(category);
    setName(category.name);
    setColor(category.color);
    setNameError("");
    setActionError("");
    setFormOpen(true);
  }

  async function saveCategory() {
    if (actionLocked.current) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Enter a category name.");
      return;
    }
    const duplicate = categories.some(
      (category) =>
        category.id !== editing?.id &&
        normalizeCategoryName(category.name) === normalizeCategoryName(trimmed),
    );
    if (duplicate) {
      setNameError("This category already exists.");
      return;
    }

    try {
      actionLocked.current = true;
      setPendingAction({ kind: "saving", categoryId: editing?.id });
      if (editing) {
        await onUpdate(editing.id, { name: trimmed, color });
        notify.success("Category updated.");
      } else {
        await onCreate({ name: trimmed, color });
        notify.success("Category added.");
      }
      setFormOpen(false);
    } catch {
      notify.error("Could not save the category. Try again.");
    } finally {
      actionLocked.current = false;
      setPendingAction(null);
    }
  }

  async function confirmDelete() {
    if (actionLocked.current) return;
    if (!deleteTarget) return;
    if (usageCount > 0 && !replacementId) {
      setActionError("Choose another active category.");
      return;
    }
    try {
      actionLocked.current = true;
      setPendingAction({ kind: usageCount > 0 ? "moving" : "deleting", categoryId: deleteTarget.id });
      await onDelete(deleteTarget.id, usageCount > 0 ? replacementId : undefined);
      notify.success(usageCount > 0 ? "Records moved and category deleted." : "Category deleted.");
      setDeleteTarget(null);
      setReplacementId("");
      setActionError("");
    } catch {
      notify.error(usageCount > 0 ? "Could not move the records. Try again." : "Could not delete the category. Try again.");
    } finally {
      actionLocked.current = false;
      setPendingAction(null);
    }
  }

  async function toggleCategory(category: T) {
    if (actionLocked.current) return;
    try {
      actionLocked.current = true;
      const nextActive = !category.active;
      setPendingAction({ kind: nextActive ? "showing" : "hiding", categoryId: category.id });
      await onSetActive(category.id, nextActive);
      notify.success(nextActive ? "Category shown again." : "Category hidden.");
      setActionError("");
    } catch {
      notify.error("Could not save the category. Try again.");
    } finally {
      actionLocked.current = false;
      setPendingAction(null);
    }
  }

  return (
    <section className="surface-card overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Button disabled={Boolean(loadError)} onClick={openCreate}>Add category</Button>
      </div>

      {loadError && <div className="m-5"><DataErrorState onRetry={onRetry} /></div>}
      {actionError && !formOpen && !deleteTarget && (
        <div className="alert-tone alert-tone-error m-5" role="alert">{actionError}</div>
      )}

      {!loadError && (categories.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-sm font-medium text-foreground">No {recordName} categories yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {recordName === "service"
              ? "Add categories that match the services you offer."
              : "Add categories that match your business expenses."}
          </p>
          <Button className="mt-4" onClick={openCreate}>Add category</Button>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {categories.map((category) => {
            const count = usageCounts[category.id] ?? 0;
            const rowPending = pendingAction?.categoryId === category.id;
            return (
              <article key={category.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className="mt-1 size-3 shrink-0 rounded-full ring-2 ring-white outline outline-1 outline-border"
                    style={{ backgroundColor: category.color }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-foreground">{category.name}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${category.active ? "bg-emerald-50 text-[var(--status-success)]" : "bg-muted text-muted-foreground"}`}>
                        {category.active ? "Active" : "Hidden"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Used by {count} {recordName}{count === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <Button variant="outline" size="sm" disabled={rowPending} onClick={() => openEdit(category)}>Edit</Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={rowPending}
                    onClick={() => toggleCategory(category)}
                  >
                    {rowPending && pendingAction?.kind === "hiding" ? "Hiding…" : rowPending && pendingAction?.kind === "showing" ? "Showing…" : category.active ? "Hide" : "Show again"}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={rowPending}
                    onClick={() => {
                      setDeleteTarget(category);
                      setReplacementId("");
                      setActionError("");
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      ))}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit category" : "Add category"}</DialogTitle>
            <DialogDescription>Choose a clear name and a simple color.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div>
              <Label htmlFor="category-name" className="mb-2">Name</Label>
              <Input
                id="category-name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setNameError("");
                  setActionError("");
                }}
                aria-invalid={Boolean(nameError)}
              />
              {nameError && <p className="mt-2 text-sm text-destructive">{nameError}</p>}
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Color</legend>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_COLORS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-label={option.label}
                    aria-pressed={color === option.value}
                    onClick={() => setColor(option.value)}
                    className={`flex size-10 items-center justify-center rounded-lg border bg-white ${color === option.value ? "border-[var(--focus)] ring-2 ring-[var(--focus)]/25" : "border-border"}`}
                  >
                    <span className="size-5 rounded-full" style={{ backgroundColor: option.value }} />
                  </button>
                ))}
              </div>
            </fieldset>
            {actionError && <p className="text-sm text-destructive">{actionError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={pendingAction !== null} onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button disabled={pendingAction !== null} onClick={saveCategory}>
              {pendingAction?.kind === "saving" && <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              {pendingAction?.kind === "saving" ? (editing ? "Updating…" : "Saving…") : editing ? "Save changes" : "Add category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setReplacementId("");
            setActionError("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this category?</AlertDialogTitle>
            <AlertDialogDescription>
              {usageCount === 0
                ? "This cannot be undone."
                : `This category is used by ${usageCount} ${recordName}${usageCount === 1 ? "" : "s"}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {usageCount > 0 && (
            <div>
              <Label className="mb-2">Move records to</Label>
              <Select value={replacementId} onValueChange={(value) => setReplacementId(value ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose another category">
                    {replacementId
                      ? replacements.find((category) => category.id === replacementId)?.name
                      : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {replacements.map((category) => (
                    <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {actionError && <p className="text-sm text-destructive">{actionError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendingAction !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={pendingAction !== null} onClick={confirmDelete}>
              {(pendingAction?.kind === "moving" || pendingAction?.kind === "deleting") && <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              {pendingAction?.kind === "moving" ? "Moving…" : pendingAction?.kind === "deleting" ? "Deleting…" : usageCount > 0 ? "Move and delete" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
