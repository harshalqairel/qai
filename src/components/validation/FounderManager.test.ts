import { afterEach, describe, expect, it, vi } from "vitest";

import { FOUNDER_WORKSPACE_LOAD_ERROR, FounderApiError, founderApi, handleFounderWorkspaceLoadFailure } from "./FounderManager";

afterEach(() => { vi.unstubAllGlobals(); });

function response(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe("FounderManager request handling", () => {
  it("redirects to founder login only for a 401", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(401, { error: "Founder access is required." })));

    const error = await founderApi("/api/validation/admin/workspaces").catch((caught) => caught);
    const redirect = vi.fn();
    const showError = vi.fn();
    handleFounderWorkspaceLoadFailure(error, redirect, showError);

    expect(error).toBeInstanceOf(FounderApiError);
    expect(redirect).toHaveBeenCalledWith("/validation/founder/login");
    expect(showError).not.toHaveBeenCalled();
  });

  it("does not redirect for a 500 and does not expose a raw server error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(500, { error: "raw database failure containing a secret" })));

    const error = await founderApi("/api/validation/admin/workspaces").catch((caught) => caught);
    const redirect = vi.fn();
    const showError = vi.fn();
    handleFounderWorkspaceLoadFailure(error, redirect, showError);

    expect(error).toBeInstanceOf(FounderApiError);
    expect((error as Error).message).toBe("Could not complete the request. Please try again.");
    expect((error as Error).message).not.toContain("database");
    expect((error as Error).message).not.toContain("secret");
    expect(redirect).not.toHaveBeenCalled();
    expect(showError).toHaveBeenCalledWith(FOUNDER_WORKSPACE_LOAD_ERROR);
  });
});
