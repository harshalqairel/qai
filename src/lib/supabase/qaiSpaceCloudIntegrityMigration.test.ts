import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  path.join(process.cwd(), "supabase/migrations/202608290001_qai_space_cloud_integrity.sql"),
  "utf8",
);

describe("Qai Space cloud integrity migration", () => {
  it("creates durable business-owned pages, requests, and private media", () => {
    expect(migration).toContain("create table if not exists public.qai_space_pages");
    expect(migration).toContain("create table if not exists public.qai_space_requests");
    expect(migration).toContain("create table if not exists public.qai_space_media_assets");
    expect(migration).toContain("unique (business_id)");
    expect(migration).toContain("unique (slug)");
    expect(migration).toContain("'qai-space-media'");
    expect(migration).toContain("false,");
  });

  it("keeps owner tables private and workspace isolated by membership RLS", () => {
    expect(migration).toContain("alter table public.qai_space_pages enable row level security");
    expect(migration).toContain("alter table public.qai_space_requests enable row level security");
    expect(migration).toContain("alter table public.qai_space_media_assets enable row level security");
    expect(migration.match(/is_business_member\(business_id\)/g)?.length).toBeGreaterThanOrEqual(6);
    expect(migration).toContain("revoke all on table public.qai_space_pages from public, anon");
    expect(migration).toContain("revoke all on table public.qai_space_requests from public, anon");
    expect(migration).toContain("revoke all on table public.qai_space_media_assets from public, anon");
    expect(migration).not.toMatch(/grant[^;]+qai_space_(?:pages|requests|media_assets)[^;]+to anon/i);
  });

  it("normalizes Additional Charge categories before the legacy UUID writer", () => {
    expect(migration).toContain("create or replace function public.save_booking_with_integrity");
    expect(migration).toContain("category.normalized_name = lower(category_name)");
    expect(migration).toContain("values (gen_random_uuid(), target_business_id, category_name)");
    expect(migration.indexOf("normalized_payload :=")).toBeLessThan(migration.indexOf("return public.save_booking_with_questionnaire(normalized_payload)"));
    expect(migration).toContain("grant execute on function public.save_booking_with_integrity(jsonb) to authenticated");
    expect(migration).not.toMatch(/grant execute on function public\.save_booking_with_integrity\(jsonb\) to anon/i);
  });

  it("serializes capacity claims and excludes requests converted into Bookings", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("converted.capacity_source_request_id = request.id::text");
    expect(migration).toContain("booking.booking_status <> 'Cancelled'");
    expect(migration).toContain("booking_count + accepted_request_count + slot_reserved >= slot_capacity");
    expect(migration).toContain("grant execute on function public.claim_qai_space_request_capacity(uuid, jsonb) to service_role");
    expect(migration).not.toMatch(/grant execute on function public\.claim_qai_space_request_capacity[^;]+to (anon|authenticated)/i);
  });

  it("contains no destructive data operation", () => {
    expect(migration).not.toMatch(/drop\s+table|delete\s+from|truncate/i);
  });
});
