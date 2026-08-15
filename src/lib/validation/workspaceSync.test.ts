import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { writeVersionedCollection, writeVersionedCollectionsAndConfirm } from "@/lib/persistence";
import { flushWorkspaceDocuments, hydrateWorkspaceDocuments } from "@/lib/validation/workspaceSync";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("validation workspace synchronization", () => {
  it("hydrates local data and mirrors subsequent repository writes through the validation API", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
    vi.stubEnv("NEXT_PUBLIC_QAI_CLOUD_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_QAI_VALIDATION_ENABLED", "true");

    const localStorage = new MemoryStorage();
    vi.stubGlobal("window", { localStorage });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{
          storageKey: "qai:customers",
          value: { version: 1, data: [{ id: "customer-1" }], updatedAt: 1 },
          updatedAt: "2026-08-12T00:00:00.000Z",
        }],
        workspace: { label: "Ayu Studio", slug: "ayu-studio" },
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await hydrateWorkspaceDocuments();

    expect(JSON.parse(localStorage.getItem("qai:customers") ?? "null").data).toEqual([{ id: "customer-1" }]);
    expect(JSON.parse(localStorage.getItem("qai:validation-workspace") ?? "null").label).toBe("Ayu Studio");

    writeVersionedCollection("qai:test-records", z.object({ id: z.string() }), [{ id: "record-1" }]);
    await flushWorkspaceDocuments();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const postRequest = fetchMock.mock.calls[1];
    expect(postRequest[0]).toBe("/api/validation/documents");
    expect(postRequest[1]).toMatchObject({ method: "POST" });
    expect(JSON.parse(String(postRequest[1]?.body))).toMatchObject({
      documents: [{ storageKey: "qai:test-records", value: { data: [{ id: "record-1" }] } }],
    });
  });

  it("waits for remote confirmation before completing a bulk operation", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
    vi.stubEnv("NEXT_PUBLIC_QAI_VALIDATION_ENABLED", "true");
    const localStorage = new MemoryStorage();
    vi.stubGlobal("window", { localStorage });

    let confirmRemote!: (response: Response) => void;
    const remoteResponse = new Promise<Response>((resolve) => { confirmRemote = resolve; });
    vi.stubGlobal("fetch", vi.fn(() => remoteResponse));

    let completed = false;
    const operation = writeVersionedCollectionsAndConfirm([
      { storageKey: "qai:test-records", recordSchema: z.object({ id: z.string() }), records: [{ id: "record-1" }] },
    ]).then(() => { completed = true; });

    await Promise.resolve();
    expect(completed).toBe(false);
    confirmRemote(new Response(JSON.stringify({ data: { saved: 1 } }), { status: 200 }));
    await operation;
    expect(completed).toBe(true);
  });

  it("restores exact local snapshots when remote bulk confirmation fails", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
    vi.stubEnv("NEXT_PUBLIC_QAI_VALIDATION_ENABLED", "true");
    const localStorage = new MemoryStorage();
    const previous = JSON.stringify({ version: 1, data: [{ id: "before" }], updatedAt: 1 });
    localStorage.setItem("qai:test-records", previous);
    vi.stubGlobal("window", { localStorage });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "failed" }), { status: 500 })));

    await expect(writeVersionedCollectionsAndConfirm([
      { storageKey: "qai:test-records", recordSchema: z.object({ id: z.string() }), records: [{ id: "after" }] },
      { storageKey: "qai:new-records", recordSchema: z.object({ id: z.string() }), records: [{ id: "new" }] },
    ])).rejects.toMatchObject({ stage: "remote-confirmation" });

    expect(localStorage.getItem("qai:test-records")).toBe(previous);
    expect(localStorage.getItem("qai:new-records")).toBeNull();
  });
});
