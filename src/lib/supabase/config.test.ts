import { afterEach, describe, expect, it, vi } from "vitest";

import { isCloudModeEnabled, isValidationModeEnabled } from "@/lib/supabase/config";

function setModeFlags(cloudEnabled: boolean, validationEnabled: boolean): void {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
  vi.stubEnv("NEXT_PUBLIC_QAI_CLOUD_ENABLED", String(cloudEnabled));
  vi.stubEnv("NEXT_PUBLIC_QAI_VALIDATION_ENABLED", String(validationEnabled));
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Qai data mode precedence", () => {
  it.each([
    { cloudFlag: false, validationFlag: false, cloudMode: false, validationMode: false },
    { cloudFlag: true, validationFlag: false, cloudMode: true, validationMode: false },
    { cloudFlag: true, validationFlag: true, cloudMode: false, validationMode: true },
    { cloudFlag: false, validationFlag: true, cloudMode: false, validationMode: true },
  ])(
    "resolves cloud=$cloudFlag and validation=$validationFlag",
    ({ cloudFlag, validationFlag, cloudMode, validationMode }) => {
      setModeFlags(cloudFlag, validationFlag);

      expect(isCloudModeEnabled()).toBe(cloudMode);
      expect(isValidationModeEnabled()).toBe(validationMode);
    },
  );

  it("keeps both modes disabled without public Supabase configuration", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_QAI_CLOUD_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_QAI_VALIDATION_ENABLED", "true");

    expect(isCloudModeEnabled()).toBe(false);
    expect(isValidationModeEnabled()).toBe(false);
  });
});
