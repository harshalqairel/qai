"use client";

import { ReactNode, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/notifications";

type DeleteActionProps = {
  itemName: string;
  onConfirm: () => boolean | "blocked" | Promise<boolean | "blocked">;
  successMessage: string;
  errorMessage: string;
  blockedMessage?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  triggerClassName?: string;
  confirmLabel?: string;
  children?: ReactNode;
};

export default function DeleteAction({
  itemName,
  onConfirm,
  successMessage,
  errorMessage,
  blockedMessage,
  open,
  onOpenChange,
  hideTrigger = false,
  triggerClassName,
  confirmLabel = "Delete",
  children = "Delete",
}: DeleteActionProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const locked = useRef(false);
  const dialogOpen = open ?? uncontrolledOpen;

  function setDialogOpen(nextOpen: boolean) {
    if (open === undefined) {
      setUncontrolledOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  }

  async function remove() {
    if (locked.current) return;
    locked.current = true;
    setDeleting(true);
    try {
      const succeeded = await Promise.resolve(onConfirm());
      if (succeeded === "blocked") {
        notify.error(blockedMessage ?? errorMessage);
        return;
      }
      if (!succeeded) {
        notify.error(errorMessage);
        return;
      }
      notify.success(successMessage);
      setDialogOpen(false);
    } catch {
      notify.error(errorMessage);
    } finally {
      locked.current = false;
      setDeleting(false);
    }
  }

  return (
    <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {!hideTrigger && (
        <AlertDialogTrigger
          render={<Button type="button" variant="destructive" className={triggerClassName} />}
        >
          {children}
        </AlertDialogTrigger>
      )}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {itemName}?</AlertDialogTitle>
          <AlertDialogDescription>This can&apos;t be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction type="button" variant="destructive" disabled={deleting} onClick={remove}>
            {deleting && <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            {deleting ? "Deleting…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
