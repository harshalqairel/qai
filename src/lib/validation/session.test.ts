import { afterEach, describe, expect, it, vi } from "vitest";

import { hashValidationSecret, signValidationPayload, verifyValidationPayload } from "./session";
import { createValidationCode, normalizeValidationCode, randomValidationToken, validationSlug } from "./tokens";

afterEach(() => { vi.unstubAllEnvs(); });

describe("validation access credentials", () => {
  it("signs sessions, rejects tampering, and rejects expiry", async () => {
    vi.stubEnv("QAI_VALIDATION_SESSION_SECRET", "a-distinct-validation-session-secret-123456789");
    const valid = await signValidationPayload({ kind: "founder", expiresAt: Date.now() + 60_000 });
    expect(await verifyValidationPayload(valid)).toMatchObject({ kind: "founder" });
    const replacement = valid.endsWith("x") ? "y" : "x";
    const tampered = `${valid.slice(0, -1)}${replacement}`;
    expect(tampered).not.toBe(valid);
    expect(await verifyValidationPayload(tampered)).toBeNull();
    const expired = await signValidationPayload({ kind: "founder", expiresAt: Date.now() - 1 });
    expect(await verifyValidationPayload(expired)).toBeNull();
  });

  it("normalizes fallback codes without storing the plaintext representation", async () => {
    vi.stubEnv("QAI_VALIDATION_SESSION_SECRET", "a-distinct-validation-session-secret-123456789");
    expect(normalizeValidationCode(" ardi-7k29 ")).toBe("ARDI-7K29");
    expect(await hashValidationSecret(" ardi-7k29 ")).toBe(await hashValidationSecret("ARDI-7K29"));
    expect(await hashValidationSecret("ARDI-7K29")).not.toContain("ARDI");
  });

  it("generates nontrivial invite tokens, readable codes, and safe public slugs", () => {
    const tokenA = randomValidationToken(); const tokenB = randomValidationToken();
    expect(tokenA).toHaveLength(43); expect(tokenA).not.toBe(tokenB);
    expect(createValidationCode("Ardi Photography")).toMatch(/^ARDI-[A-HJ-NP-Z2-9]{4}$/);
    expect(validationSlug("  Nüyi Makeup Studio!  ")).toBe("nuyi-makeup-studio");
  });
});
