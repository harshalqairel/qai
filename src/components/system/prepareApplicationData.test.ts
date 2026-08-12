import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({
  order: [] as string[],
  hydrate: vi.fn(),
  local: Object.fromEntries(
    ["customers", "serviceCategories", "services", "bookings", "payments", "expenseCategories", "expenses"]
      .map((name) => [name, vi.fn()]),
  ) as Record<string, ReturnType<typeof vi.fn>>,
  cloud: Object.fromEntries(
    ["customers", "serviceCategories", "services", "bookings", "payments", "expenseCategories", "expenses"]
      .map((name) => [name, vi.fn()]),
  ) as Record<string, ReturnType<typeof vi.fn>>,
}));

function localRepository(name: string) {
  return { getAll: calls.local[name] };
}

vi.mock("@/lib/validation/workspaceSync", () => ({ hydrateWorkspaceDocuments: calls.hydrate }));
vi.mock("@/features/customer/api/customerRepository", () => ({ customerRepository: localRepository("customers") }));
vi.mock("@/features/service-category/api/serviceCategoryRepository", () => ({ serviceCategoryRepository: localRepository("serviceCategories") }));
vi.mock("@/features/service/api/serviceRepository", () => ({ serviceRepository: localRepository("services") }));
vi.mock("@/features/booking/api/bookingRepository", () => ({ bookingRepository: localRepository("bookings") }));
vi.mock("@/features/payment/api/paymentRepository", () => ({ paymentRepository: localRepository("payments") }));
vi.mock("@/features/expense-category/api/expenseCategoryRepository", () => ({ expenseCategoryRepository: localRepository("expenseCategories") }));
vi.mock("@/features/expense/api/expenseRepository", () => ({ expenseRepository: localRepository("expenses") }));
vi.mock("@/lib/supabase/cloudRepositories", () => ({
  cloudCustomerRepository: { getAll: calls.cloud.customers },
  cloudServiceCategoryRepository: { getAll: calls.cloud.serviceCategories },
  cloudServiceRepository: { getAll: calls.cloud.services },
  cloudBookingRepository: { getAll: calls.cloud.bookings },
  cloudPaymentRepository: { getAll: calls.cloud.payments },
  cloudExpenseCategoryRepository: { getAll: calls.cloud.expenseCategories },
  cloudExpenseRepository: { getAll: calls.cloud.expenses },
}));

import { prepareApplicationData } from "@/components/system/prepareApplicationData";

function setModeFlags(cloudEnabled: boolean, validationEnabled: boolean): void {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
  vi.stubEnv("NEXT_PUBLIC_QAI_CLOUD_ENABLED", String(cloudEnabled));
  vi.stubEnv("NEXT_PUBLIC_QAI_VALIDATION_ENABLED", String(validationEnabled));
}

beforeEach(() => {
  calls.order.length = 0;
  calls.hydrate.mockReset().mockImplementation(async () => { calls.order.push("hydrate"); });
  for (const [name, mock] of Object.entries(calls.local)) {
    mock.mockReset().mockImplementation(() => { calls.order.push(`local:${name}`); return []; });
  }
  for (const [name, mock] of Object.entries(calls.cloud)) {
    mock.mockReset().mockImplementation(async () => { calls.order.push(`cloud:${name}`); return []; });
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("application data startup", () => {
  it("hydrates before loading only local repositories when both flags are true", async () => {
    setModeFlags(true, true);

    await prepareApplicationData();

    expect(calls.order[0]).toBe("hydrate");
    expect(Object.values(calls.local).every((mock) => mock.mock.calls.length === 1)).toBe(true);
    expect(Object.values(calls.cloud).every((mock) => mock.mock.calls.length === 0)).toBe(true);
  });

  it("loads commercial cloud repositories when only cloud mode is enabled", async () => {
    setModeFlags(true, false);

    await prepareApplicationData();

    expect(Object.values(calls.local).every((mock) => mock.mock.calls.length === 0)).toBe(true);
    expect(Object.values(calls.cloud).every((mock) => mock.mock.calls.length === 1)).toBe(true);
  });
});
