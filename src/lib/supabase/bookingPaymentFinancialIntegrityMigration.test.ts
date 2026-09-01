import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  path.join(process.cwd(), "supabase/migrations/202608310001_booking_payment_financial_integrity.sql"),
  "utf8",
);

describe("Booking and Payment financial integrity migration", () => {
  it("caps every Payment against persisted Service price plus persisted Additional Charges", () => {
    expect(migration).toContain("booking.service_price + coalesce");
    expect(migration).toContain("from public.booking_additional_charges charge");
    expect(migration).toContain("paid_before_write + new.amount > target_total");
    expect(migration).not.toContain("paid_before_write + new.amount >= target_total");
  });

  it("saves the Booking aggregate before inserting the initial Payment in one RPC transaction", () => {
    const functionStart = migration.indexOf("create or replace function public.save_booking_with_initial_payment");
    const bookingSave = migration.indexOf("public.save_booking_with_integrity(booking_payload)", functionStart);
    const paymentInsert = migration.indexOf("insert into public.payments", functionStart);
    expect(functionStart).toBeGreaterThan(-1);
    expect(bookingSave).toBeGreaterThan(functionStart);
    expect(paymentInsert).toBeGreaterThan(bookingSave);
    expect(migration.slice(functionStart)).not.toContain("exception when");
  });

  it("enforces authenticated workspace ownership and grants no anonymous execution", () => {
    expect(migration).toContain("if (select auth.uid()) is null");
    expect(migration).toContain("public.is_business_member(booking.business_id)");
    expect(migration).toContain("revoke all on function public.save_booking_with_initial_payment(jsonb, jsonb) from public, anon");
    expect(migration).toContain("grant execute on function public.save_booking_with_initial_payment(jsonb, jsonb) to authenticated");
    expect(migration).not.toContain("grant execute on function public.save_booking_with_initial_payment(jsonb, jsonb) to anon");
  });
});
