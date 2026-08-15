import { isValidationModeEnabled } from "@/lib/supabase/config";

type RemoteDocument = { storageKey: string; value: unknown; updatedAt: string };

export class WorkspaceDocumentSyncError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "WorkspaceDocumentSyncError";
    this.status = status;
  }
}

let hydration = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const pending = new Map<string, unknown>();

function scheduleWorkspaceDocumentFlush(): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => { void flushWorkspaceDocuments().catch(() => undefined); }, 180);
}

export function queueWorkspaceDocumentWrite(storageKey: string, serialized: string): void {
  if (!isValidationModeEnabled() || hydration || typeof window === "undefined" || !storageKey.startsWith("qai:")) return;
  try { pending.set(storageKey, JSON.parse(serialized)); } catch { return; }
  scheduleWorkspaceDocumentFlush();
}

export function discardPendingWorkspaceDocumentWrites(storageKeys: readonly string[]): void {
  for (const storageKey of storageKeys) pending.delete(storageKey);
  if (pending.size === 0 && flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}

async function persistWorkspaceDocuments(documents: Array<{ storageKey: string; value: unknown }>): Promise<void> {
  if (!documents.length || !isValidationModeEnabled()) return;
  let response: Response;
  try {
    response = await fetch("/api/validation/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documents }),
    });
  } catch {
    throw new WorkspaceDocumentSyncError("The remote workspace could not be reached.");
  }
  if (!response.ok) {
    throw new WorkspaceDocumentSyncError("The remote workspace rejected the data.", response.status);
  }
}

export async function flushWorkspaceDocuments(storageKeys?: readonly string[]): Promise<void> {
  if (!pending.size) return;
  const selectedKeys = storageKeys ? new Set(storageKeys) : null;
  const documents = Array.from(pending, ([storageKey, value]) => ({ storageKey, value }))
    .filter((document) => !selectedKeys || selectedKeys.has(document.storageKey));
  if (!documents.length) return;
  for (const document of documents) pending.delete(document.storageKey);
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  if (pending.size > 0) scheduleWorkspaceDocumentFlush();
  try {
    await persistWorkspaceDocuments(documents);
  } catch (error) {
    for (const item of documents) pending.set(item.storageKey, item.value);
    scheduleWorkspaceDocumentFlush();
    throw error;
  }
}

export async function hydrateWorkspaceDocuments(): Promise<void> {
  if (!isValidationModeEnabled() || typeof window === "undefined") return;
  const response = await fetch("/api/validation/documents", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load remote workspace.");
  const result = await response.json() as { data: RemoteDocument[]; workspace: { label: string; slug: string } | null };
  hydration = true;
  try {
    for (const document of result.data) window.localStorage.setItem(document.storageKey, JSON.stringify(document.value));
    if (result.workspace) window.localStorage.setItem("qai:validation-workspace", JSON.stringify(result.workspace));
  } finally { hydration = false; }
}
