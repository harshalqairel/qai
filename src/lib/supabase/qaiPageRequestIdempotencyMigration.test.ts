import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(path.join(process.cwd(), "supabase/migrations/202608260001_qai_page_request_booking_idempotency.sql"), "utf8");

describe("Qai Page request Booking idempotency migration", () => {
  it("enforces one Booking per business/request without affecting legacy null records", () => {
    expect(migration).toContain("on public.bookings (business_id, capacity_source_request_id)");
    expect(migration).toContain("where capacity_source_request_id is not null");
    expect(migration).toContain("create or replace function public.validation_backend_capabilities()");
    expect(migration).toContain("grant execute on function public.validation_backend_capabilities() to service_role");
    expect(migration).not.toMatch(/grant execute on function public\.validation_backend_capabilities\(\) to (anon|authenticated)/i);
    expect(migration).not.toMatch(/drop\s+table|delete\s+from|truncate/i);
  });
});
