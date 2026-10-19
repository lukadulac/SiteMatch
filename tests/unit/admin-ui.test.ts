import { describe, expect, it } from "vitest";
import { adminListUrl, moderationChoices, parseAdminListParams, parseAdminListResponse } from "@/lib/admin/ui";

describe("admin list UI contract", () => {
  it("normalizes invalid parameters to a safe first page", () => {
    expect(parseAdminListParams("users", { filter: "hidden", page: "-2" })).toEqual({ filter: "all", page: 1, normalized: true });
    expect(parseAdminListParams("services", { filter: ["hidden", "all"], page: "1e4" })).toEqual({ filter: "all", page: 1, normalized: true });
  });

  it("preserves a valid filter in pagination links", () => {
    expect(adminListUrl("services", "hidden", 2)).toBe("/dashboard/admin/services?filter=hidden&page=2");
    expect(adminListUrl("users", "all", 1)).toBe("/dashboard/admin/users");
  });

  it("rejects a malformed or incomplete backend response", () => {
    expect(() => parseAdminListResponse("users", { items: [{ id: "bad" }], totalCount: 1, page: 1, pageSize: 20 })).toThrow();
  });

  it("shows only relevant moderation decisions", () => {
    expect(moderationChoices("service", "visible")).toEqual(["hide", "delete"]);
    expect(moderationChoices("project", "hidden")).toEqual(["restore", "delete"]);
    expect(moderationChoices("user", "active")).toEqual(["suspend", "ban", "delete"]);
    expect(moderationChoices("user", "banned")).toEqual(["reactivate", "delete"]);
    expect(moderationChoices("user", "deleted")).toEqual([]);
    expect(moderationChoices("user", "deleted", true)).toEqual(["delete"]);
  });
});
