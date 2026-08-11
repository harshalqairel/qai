import { isValidationModeEnabled } from "@/lib/supabase/config";

type RemoteDocument = { storageKey: string; value: unknown; updatedAt: string };

let hydration = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const pending = new Map<string, unknown>();

export function queueWorkspaceDocumentWrite(storageKey: string, serialized: string): void {
  if (!isValidationModeEnabled() || hydration || typeof window === "undefined" || !storageKey.startsWith("qai:")) return;
  try { pending.set(storageKey, JSON.parse(serialized)); } catch { return; }
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => { void flushWorkspaceDocuments(); }, 180);
}

export async function flushWorkspaceDocuments(): Promise<void> {
  if (!pending.size) return;
  const documents = Array.from(pending, ([storageKey, value]) => ({ storageKey, value }));
  pending.clear();
  flushTimer = null;
  const response = await fetch("/api/validation/documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documents }) });
  if (!response.ok) for (const item of documents) pending.set(item.storageKey, item.value);
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
