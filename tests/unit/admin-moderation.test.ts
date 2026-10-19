import { describe, expect, it, vi } from "vitest";
import { getAdminRecords, moderate } from "@/lib/admin/service";
import { adminListSchema, moderationSchema } from "@/lib/admin/schemas";
import { isAccountEnabled } from "@/lib/auth/account-access";
import { createSupabaseStub } from "../helpers/supabase-stub";

const actorId = "11111111-1111-4111-8111-111111111111";
const targetId = "22222222-2222-4222-8222-222222222222";
const user = { id: actorId, email_confirmed_at: "2026-10-01T00:00:00Z" };
const input = { targetType: "service", targetId, decision: "hide", reason: "Misleading service description." };

describe("admin moderation", () => {
  it("rejects guests before making database calls", async () => {
    const stub = createSupabaseStub();
    expect(await moderate(stub.client, input)).toMatchObject({ status: 401 });
    expect(stub.callKeys()).toEqual([]);
  });
  it("rejects unverified users", async () => {
    const stub = createSupabaseStub({}, { user: { id: actorId } });
    expect(await moderate(stub.client, input)).toMatchObject({ status: 401 });
  });
  it("rejects a non-admin, including an inactive admin", async () => {
    const stub = createSupabaseStub({ "rpc.is_admin": { data: false } }, { user });
    expect(await moderate(stub.client, input)).toMatchObject({ status: 403 });
    expect(stub.callKeys()).toEqual(["rpc.is_admin"]);
  });
  it("validates before writing and never accepts an actor ID from the browser", async () => {
    const stub = createSupabaseStub({ "rpc.is_admin": { data: true } }, { user });
    expect(await moderate(stub.client, { ...input, actorId: targetId })).toMatchObject({ status: 400 });
    expect(stub.callKeys()).toEqual(["rpc.is_admin"]);
  });
  it("uses the atomic listing RPC with the trimmed reason", async () => {
    const stub = createSupabaseStub({
      "rpc.is_admin": { data: true }, "rpc.admin_moderate_listing": { data: { id: targetId, action: "hide" } },
    }, { user });
    expect(await moderate(stub.client, { ...input, reason: ` ${input.reason} ` })).toMatchObject({ data: { action: "hide" } });
    expect(stub.callsFor("rpc.admin_moderate_listing")[0].payload).toEqual({
      target_type: "service", target_id: targetId, decision: "hide", reason: input.reason,
    });
  });
  it("rejects self moderation", async () => {
    const stub = createSupabaseStub({ "rpc.is_admin": { data: true } }, { user });
    expect(await moderate(stub.client, { ...input, targetType: "user", targetId: actorId, decision: "ban" })).toMatchObject({ status: 403 });
  });
  it("returns a conflict without exposing database internals", async () => {
    const stub = createSupabaseStub({
      "rpc.is_admin": { data: true }, "rpc.admin_moderate_listing": { error: { code: "55000", message: "private detail" } },
    }, { user });
    const result = await moderate(stub.client, { ...input, decision: "delete" });
    expect(result.status).toBe(409);
    expect(result.error).not.toContain("private detail");
  });
  it("fails before deleting data if Auth admin credentials are missing", async () => {
    const stub = createSupabaseStub({ "rpc.is_admin": { data: true } }, { user });
    expect(await moderate(stub.client, { ...input, targetType: "user", decision: "delete" })).toMatchObject({ status: 503 });
    expect(stub.callKeys()).toEqual(["rpc.is_admin"]);
  });
  it("blocks/anonymizes before soft deleting Auth and confirms completion", async () => {
    const stub = createSupabaseStub({
      "rpc.is_admin": { data: true }, "rpc.admin_moderate_user": { data: { id: targetId } },
      "rpc.admin_confirm_auth_deleted": { data: null },
    }, { user });
    const deleteUser = vi.fn(async () => {
      expect(stub.callKeys()).toEqual(["rpc.is_admin", "rpc.admin_moderate_user"]);
      return { data: { user: null }, error: null };
    });
    expect(await moderate(stub.client, { ...input, targetType: "user", decision: "delete" }, () => ({ deleteUser }))).toEqual({ data: { id: targetId } });
    expect(deleteUser).toHaveBeenCalledWith(targetId, true);
    expect(stub.callKeys().at(-1)).toBe("rpc.admin_confirm_auth_deleted");
  });
  it("reports retryable Auth failure after the account has been blocked", async () => {
    const stub = createSupabaseStub({
      "rpc.is_admin": { data: true }, "rpc.admin_moderate_user": { data: { id: targetId } },
    }, { user });
    const deleteUser = vi.fn().mockResolvedValue({ error: { message: "upstream failure" } });
    const result = await moderate(stub.client, { ...input, targetType: "user", decision: "delete" }, () => ({ deleteUser }));
    expect(result).toMatchObject({ status: 503 });
    expect(result.error).toContain("pending");
    expect(stub.callKeys()).not.toContain("rpc.admin_confirm_auth_deleted");
  });
  it("retries confirmation without deleting Auth twice", async () => {
    const stub = createSupabaseStub({
      "rpc.is_admin": { data: true }, "rpc.admin_moderate_user": { data: { id: targetId, authDeleted: true } },
      "rpc.admin_confirm_auth_deleted": { data: null },
    }, { user });
    const deleteUser = vi.fn();
    const result = await moderate(stub.client, { ...input, targetType: "user", decision: "delete" }, () => ({ deleteUser }));
    expect(result.error).toBeUndefined();
    expect(deleteUser).not.toHaveBeenCalled();
  });
  it("paginates privileged reads and checks admin permissions first", async () => {
    const stub = createSupabaseStub({ "rpc.is_admin": { data: true }, "rpc.admin_list_records": { data: { items: [], totalCount: 0 } } }, { user });
    await getAdminRecords(stub.client, { resource: "users", page: "2", filter: "banned" });
    expect(stub.callsFor("rpc.admin_list_records")[0].payload).toEqual({ resource: "users", page_number: 2, filter_value: "banned" });
  });
});

describe("moderation validation", () => {
  it.each(["", "short", " ".repeat(20), "x".repeat(2001)])("requires a meaningful reason", (reason) => {
    expect(moderationSchema.safeParse({ ...input, reason }).success).toBe(false);
  });
  it("requires future expiry only for suspensions", () => {
    const base = { ...input, targetType: "user", decision: "suspend" };
    expect(moderationSchema.safeParse(base).success).toBe(false);
    expect(moderationSchema.safeParse({ ...base, suspendedUntil: "2000-01-01T00:00:00Z" }).success).toBe(false);
    expect(moderationSchema.safeParse({ ...base, suspendedUntil: "2099-01-01T00:00:00Z" }).success).toBe(true);
    expect(moderationSchema.safeParse({ ...base, decision: "ban", suspendedUntil: "2099-01-01T00:00:00Z" }).success).toBe(false);
  });
  it.each([0, -1, 1.5, "abc", 1000001])("rejects invalid page %s", (page) => {
    expect(adminListSchema.safeParse({ resource: "users", page }).success).toBe(false);
  });
  it("rejects resource-specific filter mismatches", () => {
    expect(adminListSchema.safeParse({ resource: "services", filter: "banned" }).success).toBe(false);
    expect(adminListSchema.safeParse({ resource: "audit", filter: "hidden" }).success).toBe(false);
  });
  it("account access fails closed on database errors", async () => {
    const stub = createSupabaseStub({ "rpc.is_account_enabled": { error: { message: "down" } } });
    expect(await isAccountEnabled(stub.client, actorId)).toBe(false);
  });
});
