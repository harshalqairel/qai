import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  path.resolve(process.cwd(), "supabase/migrations/202608300001_qai_space_service_role_read_grants.sql"),
  "utf8",
).toLowerCase();
const sql = migration.replace(/--.*$/gm, "");

describe("Qai Space service-role read grants migration", () => {
  it("grants only the three operational reads required by public Qai Space", () => {
    expect(sql).toMatch(/grant\s+select\s+on table\s+public\.services,\s+public\.bookings,\s+public\.booking_sessions\s+to service_role;/);
    expect(sql).not.toMatch(/grant\s+(?:insert|update|delete|truncate|references|trigger|all)/);
  });

  it("does not expose operational tables to anon or alter tenant policies", () => {
    expect(sql).not.toMatch(/\bto\s+(?:public|anon|authenticated)\b/);
    expect(sql).not.toContain("create policy");
    expect(sql).not.toContain("alter table");
    expect(sql).not.toContain("disable row level security");
  });
});
