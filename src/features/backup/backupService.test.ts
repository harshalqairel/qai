// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";

import { restoreBackup } from "./backupService";
import { QAI_BACKUP_APP, QAI_BACKUP_VERSION, type QaiBackupFile } from "./types";

const emptyBackup: QaiBackupFile = {
  app: QAI_BACKUP_APP,
  backupVersion: QAI_BACKUP_VERSION,
  createdAt: "2026-08-14T00:00:00.000Z",
  data: {
    customers: [],
    services: [],
    bookings: [],
    payments: [],
    expenses: [],
    serviceCategories: [],
    expenseCategories: [],
    additionalChargeCategories: [],
  },
};

function enableValidationMode() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
  vi.stubEnv("NEXT_PUBLIC_QAI_VALIDATION_ENABLED", "true");
}

afterEach(() => {
  window.localStorage.clear();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("backup restore persistence", () => {
  it("does not report success until the remote workspace confirms the full batch", async () => {
    enableValidationMode();
    let confirmRemote!: (response: Response) => void;
    const response = new Promise<Response>((resolve) => { confirmRemote = resolve; });
    const fetchMock = vi.fn(() => response);
    vi.stubGlobal("fetch", fetchMock);

    let completed = false;
    const restoring = restoreBackup(emptyBackup).then((result) => {
      completed = true;
      return result;
    });
    await Promise.resolve();
    expect(completed).toBe(false);

    confirmRemote(new Response(JSON.stringify({ data: { saved: 8 } }), { status: 200 }));
    await expect(restoring).resolves.toEqual({ ok: true });
    const request = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(request[1]?.body)).documents).toHaveLength(8);
  });

  it("restores the previous local workspace when remote confirmation fails", async () => {
    enableValidationMode();
    const previous = JSON.stringify({ version: 1, data: [], updatedAt: 123 });
    window.localStorage.setItem("qai:customers", previous);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await restoreBackup(emptyBackup);

    expect(result).toMatchObject({ ok: false, stage: "remote-confirmation" });
    expect(window.localStorage.getItem("qai:customers")).toBe(previous);
    expect(window.localStorage.getItem("qai:bookings")).toBeNull();
  });
});
