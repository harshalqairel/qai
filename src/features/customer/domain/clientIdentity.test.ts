import { describe, expect, it } from "vitest";
import type { Customer } from "@/features/customer/types";
import { findClientMatches, normalizeClientInstagram, normalizeClientPhone, uniqueStrongClientMatch } from "./clientIdentity";

const customers: Customer[] = [
  { id: "a", name: "Sarah Kim", phone: "0812 3456", instagram: "@sarahkim", email: "sarah@example.com", notes: "", createdAt: 1 },
  { id: "b", name: "Sarah Kim", phone: "0811 9999", instagram: "https://instagram.com/sarahbeauty/", email: "other@example.com", notes: "", createdAt: 2 },
];

describe("client identity matching", () => {
  it("allows identical names and treats name-only matches as weak", () => {
    const matches = findClientMatches({ name: " sarah  kim " }, customers);
    expect(matches).toHaveLength(2);
    expect(matches.every((match) => !match.strong)).toBe(true);
    expect(uniqueStrongClientMatch({ name: "Sarah Kim" }, customers)).toBeNull();
  });

  it("normalizes phone and Instagram identity without making names unique", () => {
    expect(normalizeClientPhone("+62 812-3456")).toBe("628123456");
    expect(normalizeClientPhone("0812 3456")).toBe("628123456");
    expect(normalizeClientInstagram("https://instagram.com/SarahBeauty/")).toBe("sarahbeauty");
    expect(uniqueStrongClientMatch({ name: "Someone else", phone: "+62 812 3456" }, customers)?.id).toBe("a");
  });

  it("does not silently choose between multiple strong matches", () => {
    const shared = [...customers, { ...customers[1], id: "c", phone: "0812 3456" }];
    expect(uniqueStrongClientMatch({ phone: "0812 3456" }, shared)).toBeNull();
  });
});
