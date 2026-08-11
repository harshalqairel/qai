"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { AlertTriangle, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { notify } from "@/lib/notifications";
import { emitDataRefresh } from "@/lib/dataRefresh";
import {
  createBackupPayload,
  downloadBackup,
  parseBackupFile,
  restoreBackup,
  toBackupValidationMessage,
} from "@/features/backup/backupService";
import type { QaiBackupFile } from "@/features/backup/types";

type BackupPreview = {
  backup: QaiBackupFile;
  formattedDate: string;
};

function formatBackupDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleString();
}

export default function DataBackupSection() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");
  const [preview, setPreview] = useState<BackupPreview | null>(null);

  const actionBusy = isDownloading || isChecking || isRestoring;

  const counts = useMemo(() => {
    if (!preview) return null;
    return {
      customers: preview.backup.data.customers.length,
      services: preview.backup.data.services.length,
      bookings: preview.backup.data.bookings.length,
      payments: preview.backup.data.payments.length,
      expenses: preview.backup.data.expenses.length,
      serviceCategories: preview.backup.data.serviceCategories.length,
      expenseCategories: preview.backup.data.expenseCategories.length,
    };
  }, [preview]);

  function resetSelectedFile() {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function handleDownloadBackup() {
    setValidationMessage("");
    setIsDownloading(true);
    try {
      const backup = createBackupPayload();
      downloadBackup(backup);
      notify.success("Backup downloaded.");
    } catch {
      notify.error("Could not create the backup. Try again.");
    } finally {
      setIsDownloading(false);
    }
  }

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;

    setValidationMessage("");
    setPreview(null);
    setIsChecking(true);
    try {
      const result = await parseBackupFile(selected);
      if (!result.ok) {
        setValidationMessage(toBackupValidationMessage(result.code));
        resetSelectedFile();
        return;
      }

      setPreview({
        backup: result.backup,
        formattedDate: formatBackupDate(result.backup.createdAt),
      });
    } catch {
      setValidationMessage("This backup file is not valid.");
      resetSelectedFile();
    } finally {
      setIsChecking(false);
    }
  }

  function triggerRestoreSelection() {
    setValidationMessage("");
    setPreview(null);
    resetSelectedFile();
    inputRef.current?.click();
  }

  function closePreview() {
    if (isRestoring) return;
    setPreview(null);
    resetSelectedFile();
  }

  function handleRestoreConfirmed() {
    if (!preview) return;

    setValidationMessage("");
    setIsRestoring(true);
    try {
      const restored = restoreBackup(preview.backup);
      if (!restored) {
        notify.error("Could not restore the backup. Your current data was not changed.");
        setPreview(null);
        resetSelectedFile();
        return;
      }

      setPreview(null);
      resetSelectedFile();
      emitDataRefresh();
      notify.success("Backup restored.");
    } catch {
      notify.error("Could not restore the backup. Your current data was not changed.");
      setPreview(null);
      resetSelectedFile();
    } finally {
      setIsRestoring(false);
    }
  }

  return (
    <section className="surface-card p-5 sm:p-6">
      <h2 className="text-lg font-bold tracking-tight">Data backup</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Save your Qai data to a file, or restore it from a backup.
      </p>

      <div className="mt-5 space-y-4">
        <div className="rounded-lg border border-border p-4">
          <h3 className="font-semibold text-foreground">Download backup</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Save a copy of your Qai data to your device.
          </p>
          <Button
            className="mt-3"
            onClick={handleDownloadBackup}
            disabled={actionBusy}
            aria-busy={isDownloading}
          >
            <Download className="size-4" aria-hidden="true" />
            {isDownloading ? "Preparing..." : "Download backup"}
          </Button>
        </div>

        <div className="rounded-lg border border-border p-4">
          <h3 className="font-semibold text-foreground">Restore backup</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Replace your current Qai data with a saved backup.
          </p>
          <p className="mt-2 inline-flex items-start gap-2 text-sm text-[var(--status-error)]">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>Restoring a backup will replace your current data.</span>
          </p>

          <label htmlFor="qai-backup-file" className="sr-only">
            Choose a Qai backup file
          </label>
          <input
            ref={inputRef}
            id="qai-backup-file"
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={handleFileSelected}
          />

          <Button
            variant="destructive"
            className="mt-3"
            onClick={triggerRestoreSelection}
            disabled={actionBusy}
            aria-busy={isChecking}
          >
            <Upload className="size-4" aria-hidden="true" />
            {isChecking ? "Checking..." : "Restore backup"}
          </Button>
        </div>
      </div>

      {validationMessage && (
        <div className="alert-tone alert-tone-error mt-4" role="alert" aria-live="assertive">
          {validationMessage}
        </div>
      )}

      <AlertDialog open={Boolean(preview)} onOpenChange={(open) => !open && closePreview()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this backup?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace your current Qai data.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {counts && preview && (
            <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 text-sm">
              <dt className="font-medium text-muted-foreground">Backup date</dt>
              <dd className="text-right text-foreground">{preview.formattedDate}</dd>
              <dt className="font-medium text-muted-foreground">Clients</dt>
              <dd className="text-right text-foreground">{counts.customers}</dd>
              <dt className="font-medium text-muted-foreground">Services</dt>
              <dd className="text-right text-foreground">{counts.services}</dd>
              <dt className="font-medium text-muted-foreground">Bookings</dt>
              <dd className="text-right text-foreground">{counts.bookings}</dd>
              <dt className="font-medium text-muted-foreground">Payments</dt>
              <dd className="text-right text-foreground">{counts.payments}</dd>
              <dt className="font-medium text-muted-foreground">Expenses</dt>
              <dd className="text-right text-foreground">{counts.expenses}</dd>
              <dt className="font-medium text-muted-foreground">Service categories</dt>
              <dd className="text-right text-foreground">{counts.serviceCategories}</dd>
              <dt className="font-medium text-muted-foreground">Expense categories</dt>
              <dd className="text-right text-foreground">{counts.expenseCategories}</dd>
            </dl>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRestoring}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleRestoreConfirmed}
              disabled={isRestoring}
              aria-busy={isRestoring}
            >
              {isRestoring ? "Restoring..." : "Restore backup"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
