import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(path.join(process.cwd(), "supabase/migrations/202609140001_client_communications.sql"), "utf8");

describe("client communications migration", () => {
  it("creates an immutable, business-scoped history with truthful launch statuses", () => {
    expect(migration).toContain("create table public.client_communications");
    expect(migration).toContain("'whatsapp_opened', 'email_draft_opened'");
    expect(migration).not.toMatch(/\bsent\b/i);
    expect(migration).toContain("foreign key (business_id, customer_id)");
    expect(migration).toContain("foreign key (business_id, booking_id)");
  });

  it("denies anonymous access and limits authenticated access to select and insert", () => {
    expect(migration).toContain("alter table public.client_communications enable row level security");
    expect(migration).toContain("revoke all on table public.client_communications from anon");
    expect(migration).toContain("grant select, insert on table public.client_communications to authenticated");
    expect(migration).not.toMatch(/grant[^;]+client_communications[^;]+to anon/i);
    expect(migration).not.toMatch(/grant (?:update|delete)[^;]+client_communications[^;]+to authenticated/i);
  });

  it("prevents Tenant A from reading or creating Tenant B communication", () => {
    expect(migration).toContain("public.is_business_member(business_id)");
    expect(migration).toContain("actor_user_id = (select auth.uid())");
    expect(migration).toContain("customer.business_id = client_communications.business_id");
    expect(migration).toContain("booking.business_id = client_communications.business_id");
    expect(migration).toContain("booking.customer_id = client_communications.customer_id");
  });

  it("contains no provider secret, OAuth token, or destructive table operation", () => {
    expect(migration).not.toMatch(/access_token|refresh_token|client_secret|provider_secret/i);
    expect(migration).not.toMatch(/drop\s+table|truncate|delete\s+from/i);
  });
});
