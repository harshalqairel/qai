"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle } from "lucide-react";

import ActionButton from "@/components/system/ActionButton";
import { Button } from "@/components/ui/button";
import {
  importLocalData,
  prepareLocalImport,
  type LocalImportPreview,
  type LocalImportResult,
} from "@/features/import/localDataImport";

export default function LocalDataImportSection() {
  const [preview, setPreview] = useState<LocalImportPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<LocalImportResult | null>(null);
  const [error, setError] = useState(false);

  async function loadPreview() {
    setLoading(true);
    setError(false);
    try {
      setPreview(await prepareLocalImport());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void loadPreview(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  async function startImport() {
    if (!preview || preview.totalRecords === 0 || importing) return;
    setImporting(true);
    setResult(null);
    const nextResult = await importLocalData(preview);
    setResult(nextResult);
    setImporting(false);
  }

  return (
    <section className="surface-card p-5 sm:p-6">
      <h2 className="text-lg font-bold tracking-tight">Import local Qai data</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        Review the records saved in this browser, then copy them into your authenticated business workspace.
        Local data is kept after a successful import.
      </p>

      {loading && (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          Checking this browser…
        </div>
      )}

      {error && (
        <div className="mt-6">
          <p className="text-sm text-destructive" role="alert">Local data could not be read safely.</p>
          <Button variant="outline" className="mt-3" onClick={() => { void loadPreview(); }}>Try again</Button>
        </div>
      )}

      {!loading && !error && preview && (
        <>
          {preview.totalRecords === 0 ? (
            <p className="mt-6 rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              No local records were found in this browser.
            </p>
          ) : (
            <>
              <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-border p-3"><dt className="text-xs text-muted-foreground">Customers</dt><dd className="mt-1 text-lg font-semibold">{preview.counts.customers}</dd></div>
                <div className="rounded-xl border border-border p-3"><dt className="text-xs text-muted-foreground">Services</dt><dd className="mt-1 text-lg font-semibold">{preview.counts.services}</dd></div>
                <div className="rounded-xl border border-border p-3"><dt className="text-xs text-muted-foreground">Bookings</dt><dd className="mt-1 text-lg font-semibold">{preview.counts.bookings}</dd></div>
                <div className="rounded-xl border border-border p-3"><dt className="text-xs text-muted-foreground">Payments & expenses</dt><dd className="mt-1 text-lg font-semibold">{preview.counts.payments + preview.counts.expenses}</dd></div>
              </dl>
              <ActionButton className="mt-5" onClick={startImport} loading={importing} loadingText="Importing…">
                Import {preview.totalRecords} records
              </ActionButton>
            </>
          )}

          {(result === "completed" || result === "already_imported") && (
            <p className="mt-5 flex items-center gap-2 text-sm font-medium text-[var(--status-success)]" role="status">
              <CheckCircle2 className="size-4" aria-hidden="true" />
              {result === "completed" ? "Import completed and verified." : "This exact local data was already imported."}
            </p>
          )}
          {result === "failed" && (
            <p className="mt-5 text-sm text-destructive" role="alert">
              Nothing was imported. Check the data relationships and try again.
            </p>
          )}
        </>
      )}
    </section>
  );
}
