"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, LoaderCircle, Plus, RefreshCcw, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { QaiLogo } from "@/components/brand/QaiLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Workspace = { id: string; label: string; public_slug: string; status: "active" | "disabled"; created_at: string; last_access_at: string | null };
type Credential = { workspaceId: string; code?: string; inviteUrl?: string };

export class FounderApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "FounderApiError";
  }
}

export async function founderApi<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  let result: { data?: T; error?: string } = {};
  try {
    result = await response.json() as { data?: T; error?: string };
  } catch {
    // Keep non-JSON server failures generic.
  }
  if (!response.ok || !result.data) {
    const message = response.status >= 500
      ? "Could not complete the request. Please try again."
      : result.error ?? "Request failed.";
    throw new FounderApiError(message, response.status || 500);
  }
  return result.data;
}

export function founderLoginRedirect(error: unknown): string | null {
  return error instanceof FounderApiError && error.status === 401 ? "/validation/founder/login" : null;
}

export const FOUNDER_WORKSPACE_LOAD_ERROR = "Could not load tester workspaces. Please try again.";

export function handleFounderWorkspaceLoadFailure(
  error: unknown,
  redirect: (url: string) => void,
  showError: (message: string) => void,
) {
  const destination = founderLoginRedirect(error);
  if (destination) redirect(destination);
  else showError(FOUNDER_WORKSPACE_LOAD_ERROR);
}

export default function FounderManager() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setWorkspaces(await founderApi<Workspace[]>("/api/validation/admin/workspaces"));
      setLoadError(null);
    } catch (error) {
      handleFounderWorkspaceLoadFailure(error, (url) => window.location.assign(url), setLoadError);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function credential(id: string) {
    return credentials.find((item) => item.workspaceId === id);
  }

  function remember(next: Credential) {
    setCredentials((current) => [
      ...current.filter((item) => item.workspaceId !== next.workspaceId),
      { ...credential(next.workspaceId), ...next },
    ]);
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const data = await founderApi<{ workspace: Workspace; code: string; inviteUrl: string }>(
        "/api/validation/admin/workspaces",
        { method: "POST", body: JSON.stringify({ label }) },
      );
      setWorkspaces((current) => [data.workspace, ...current]);
      remember({ workspaceId: data.workspace.id, code: data.code, inviteUrl: data.inviteUrl });
      setLabel("");
      toast.success("Tester workspace created.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create tester.");
    } finally {
      setBusy(false);
    }
  }

  async function action(
    workspace: Workspace,
    name: "enable" | "disable" | "regenerate-code" | "new-invite" | "revoke-invites" | "reset",
  ) {
    if (name === "reset" && !window.confirm(`Reset all validation data for ${workspace.label}? This cannot be undone.`)) return;
    try {
      const result = await founderApi<{ ok?: boolean; code?: string; inviteUrl?: string }>(
        `/api/validation/admin/workspaces/${workspace.id}`,
        { method: "POST", body: JSON.stringify({ action: name }) },
      );
      if (result.code || result.inviteUrl) {
        remember({ workspaceId: workspace.id, code: result.code, inviteUrl: result.inviteUrl });
      }
      await load();
      toast.success(name === "new-invite" ? "New invite created." : "Workspace updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed.");
    }
  }

  async function remove(workspace: Workspace) {
    if (!window.confirm(`Permanently delete ${workspace.label} and all of its validation data?`)) return;
    try {
      await founderApi(`/api/validation/admin/workspaces/${workspace.id}`, { method: "DELETE" });
      setWorkspaces((current) => current.filter((item) => item.id !== workspace.id));
      toast.success("Tester workspace deleted.");
    } catch {
      toast.error("Could not delete tester workspace.");
    }
  }

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied.`);
  }

  return (
    <main className="min-h-screen w-full bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <QaiLogo size="md" />
            <p className="mt-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--brand)]">
              <ShieldCheck className="size-4" /> Founder only
            </p>
            <h1 className="mt-2 text-3xl font-bold">Validation manager</h1>
            <p className="mt-2 text-sm text-muted-foreground">Create isolated temporary workspaces and send one-click access.</p>
          </div>
        </header>

        <form onSubmit={create} className="surface-card mt-8 grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <Label htmlFor="tester-label">Tester or business name</Label>
            <Input id="tester-label" className="mt-2" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Ardi Photography" maxLength={120} required />
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Create workspace
          </Button>
        </form>

        <section className="mt-8 space-y-4">
          {loadError ? (
            <div role="alert" className="rounded-xl border border-border bg-card p-6 text-center">
              <p className="text-sm text-foreground">{loadError}</p>
              <Button className="mt-4" size="sm" variant="outline" onClick={() => void load()}>
                <RefreshCcw className="size-3.5" /> Try again
              </Button>
            </div>
          ) : workspaces.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No tester workspaces yet.</div>
          ) : workspaces.map((workspace) => {
            const shown = credential(workspace.id);
            return (
              <article key={workspace.id} className="surface-card p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold">{workspace.label}</h2>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${workspace.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                        {workspace.status === "active" ? "Active" : "Disabled"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Created {new Date(workspace.created_at).toLocaleDateString()} · {workspace.last_access_at ? `Last used ${new Date(workspace.last_access_at).toLocaleString()}` : "Not used yet"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Public page: /q/{workspace.public_slug}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => action(workspace, workspace.status === "active" ? "disable" : "enable")}>
                      {workspace.status === "active" ? "Disable" : "Enable"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => action(workspace, "reset")}><RefreshCcw className="size-3.5" />Reset data</Button>
                    <Button size="sm" variant="destructive" onClick={() => remove(workspace)}><Trash2 className="size-3.5" />Delete</Button>
                  </div>
                </div>
                {shown && (
                  <div className="mt-5 grid gap-3 rounded-xl bg-muted/55 p-4 sm:grid-cols-2">
                    {shown.code && <CredentialRow label="New test code" value={shown.code} onCopy={() => copy(shown.code!, "Test code")} />}
                    {shown.inviteUrl && <CredentialRow label="New one-click invite" value={shown.inviteUrl} onCopy={() => copy(shown.inviteUrl!, "Invite link")} />}
                    <p className="text-xs text-muted-foreground sm:col-span-2">For security, newly generated credentials are shown only during this manager session. Copy them now.</p>
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="ghost" onClick={() => action(workspace, "regenerate-code")}>Generate new code</Button>
                  <Button size="sm" variant="ghost" onClick={() => action(workspace, "new-invite")}>Generate new invite</Button>
                  <Button size="sm" variant="ghost" onClick={() => action(workspace, "revoke-invites")}>Revoke invites</Button>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}

function CredentialRow({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-card px-3 py-2 text-xs">{value}</code>
        <Button size="icon-sm" variant="outline" aria-label={`Copy ${label}`} onClick={onCopy}>
          <Copy className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
