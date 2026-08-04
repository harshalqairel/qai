"use client";

import { useRef, useState } from "react";
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
  onConfirm: () => boolean | "blocked";
  successMessage: string;
  errorMessage: string;
  blockedMessage?: string;
};

export default function DeleteAction({
  itemName,
  onConfirm,
  successMessage,
  errorMessage,
  blockedMessage,
}: DeleteActionProps) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const locked = useRef(false);

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
      setOpen(false);
    } catch {
      notify.error(errorMessage);
    } finally {
      locked.current = false;
      setDeleting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button type="button" variant="destructive" />}>Delete</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {itemName}?</AlertDialogTitle>
          <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction type="button" variant="destructive" disabled={deleting} onClick={remove}>
            {deleting && <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            {deleting ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
