import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  path.join(process.cwd(), "supabase/migrations/202609010001_payment_write_security_boundary.sql"),
  "utf8",
);

describe("Payment write security boundary migration", () => {
  it("uses one narrow SECURITY DEFINER trigger boundary with a safe search path", () => {
    expect(migration).toContain("create or replace function public.validate_payment_write()\nreturns trigger");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain(
      "revoke all on function public.validate_payment_write() from public, anon, authenticated",
    );
    expect(migration).not.toMatch(/grant\s+update\s+on\s+(table\s+)?public\.bookings/i);
  });

  it("checks authentication, tenant membership, and Booking/business identity before locking", () => {
    const membershipCheck = migration.indexOf("public.is_business_member(new.business_id)");
    const bookingMatch = migration.indexOf("booking.business_id = new.business_id");
    const bookingIdMatch = migration.indexOf("booking.id = new.booking_id");
    const bookingLock = migration.indexOf("for update;");

    expect(migration).toContain("auth.uid()");
    expect(membershipCheck).toBeGreaterThan(-1);
    expect(bookingMatch).toBeGreaterThan(membershipCheck);
    expect(bookingIdMatch).toBeGreaterThan(bookingMatch);
    expect(bookingLock).toBeGreaterThan(bookingIdMatch);
  });

  it("locks before reading persisted Payments and includes persisted Additional Charges", () => {
    const bookingLock = migration.indexOf("for update;");
    const paymentAggregate = migration.indexOf("from public.payments payment");

    expect(migration).toContain("booking.service_price + coalesce");
    expect(migration).toContain("from public.booking_additional_charges charge");
    expect(paymentAggregate).toBeGreaterThan(bookingLock);
    expect(migration).toContain("paid_before_write + new.amount > target_total");
    expect(migration).not.toContain("paid_before_write + new.amount >= target_total");
  });

  it("rejects invalid amounts and preserves cancelled-Booking behavior", () => {
    expect(migration).toContain("new.amount is null or new.amount <= 0");
    expect(migration).toContain("target_status = 'Cancelled'");
    expect(migration).toContain("New payments cannot be added to a cancelled booking");
  });
});
