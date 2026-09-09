import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(path.join(process.cwd(), "supabase/migrations/202608250001_service_availability_and_web_push.sql"), "utf8");

describe("service availability and Web Push migration security", () => {
  it("keeps the capacity claim RPC service-role only and workspace scoped", () => {
    const normalizedMigration = migration.replace(/\r\n?/g, "\n");
    expect(normalizedMigration).toContain("security definer\nset search_path = ''");
    expect(migration).toContain("request.workspace_id = target_workspace_id");
    expect(migration).toContain("where workspace_id = target_workspace_id");
    expect(migration).toContain("request.payload->>'serviceId' = request_service_id");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("revoke all on function public.claim_validation_request_capacity(uuid, uuid, jsonb) from public, anon, authenticated");
    expect(migration).toContain("grant execute on function public.claim_validation_request_capacity(uuid, uuid, jsonb) to service_role");
    expect(migration).not.toMatch(/grant execute on function public\.claim_validation_request_capacity[^;]+to (anon|authenticated)/i);
  });

  it("extends the latest atomic Booking writer without dropping existing snapshots", () => {
    expect(migration).toContain("target_booking_id := public.save_booking(booking_payload)");
    expect(migration).toContain("questionnaire_responses = responses");
    expect(migration).toContain("service_snapshot = selection_snapshot");
    expect(migration).toContain("capacity_source_request_id = source_request_id");
    expect(migration).toContain("capacity_slot_keys = slot_keys");
  });

  it("isolates push subscriptions by the authenticated user and business membership", () => {
    expect(migration).toContain("alter table public.push_subscriptions enable row level security");
    expect(migration).toContain("user_id = (select auth.uid())");
    expect(migration).toContain("(select public.is_business_member(business_id))");
    expect(migration).toContain("revoke all on table public.push_subscriptions from public, anon");
    expect(migration).not.toMatch(/grant[^;]+push_subscriptions[^;]+to anon/i);
    expect(migration).toContain("validation_workspace_id is null");
    expect(migration).toContain("unique (business_id, user_id, endpoint)");
    expect(migration).toContain("unique (validation_workspace_id, endpoint)");
  });
});
