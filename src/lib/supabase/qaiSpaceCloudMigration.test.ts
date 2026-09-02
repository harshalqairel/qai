import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const integrity = readFileSync(path.join(process.cwd(), "supabase/migrations/202608290001_qai_space_cloud_integrity.sql"), "utf8");
const readGrants = readFileSync(path.join(process.cwd(), "supabase/migrations/202608300001_qai_space_service_role_read_grants.sql"), "utf8");
const readGrantStatements = readGrants.replace(/^--.*$/gm, "");

describe("Qai Space cloud migration boundary", () => {
  it.each(["qai_space_pages", "qai_space_requests", "qai_space_media_assets"])("keeps %s private behind member RLS", (table) => {
    expect(integrity).toContain(`alter table public.${table} enable row level security;`);
    expect(integrity).toMatch(new RegExp(`create policy ${table}_member_access[\\s\\S]*for all to authenticated[\\s\\S]*is_business_member\\(business_id\\)`, "i"));
    expect(integrity).toContain(`revoke all on table public.${table} from public, anon;`);
    expect(integrity).not.toMatch(new RegExp(`grant[^;]+on table public\\.${table}[^;]+to anon`, "i"));
  });

  it("keeps public capacity RPCs service-role-only with a safe search path", () => {
    expect(integrity).toMatch(/claim_qai_space_request_capacity[\s\S]*security definer[\s\S]*set search_path = ''/i);
    expect(integrity).toMatch(/reserve_qai_space_instant_request[\s\S]*security definer[\s\S]*set search_path = ''/i);
    expect(integrity).toContain("revoke all on function public.claim_qai_space_request_capacity(uuid, jsonb) from public, anon, authenticated;");
    expect(integrity).toContain("grant execute on function public.claim_qai_space_request_capacity(uuid, jsonb) to service_role;");
    expect(integrity).toContain("revoke all on function public.reserve_qai_space_instant_request(uuid, uuid, text, uuid, jsonb, text) from public, anon, authenticated;");
    expect(integrity).toContain("grant execute on function public.reserve_qai_space_instant_request(uuid, uuid, text, uuid, jsonb, text) to service_role;");
  });

  it("enforces workspace-scoped request idempotency and relational ownership", () => {
    expect(integrity).toContain("unique (business_id, idempotency_key)");
    expect(integrity).toContain("foreign key (business_id, page_id) references public.qai_space_pages(business_id, id)");
    expect(integrity).toContain("foreign key (business_id, service_id) references public.services(business_id, id)");
  });

  it("grants operational reads only to the server-side service role", () => {
    expect(readGrantStatements).toMatch(/grant select\s+on table public\.services,\s+public\.bookings,\s+public\.booking_sessions\s+to service_role;/i);
    expect(readGrantStatements).not.toMatch(/\bto anon\b/i);
    expect(readGrantStatements).not.toMatch(/\bto authenticated\b/i);
  });
});
