import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/admin/moderation/route";
import { GET } from "@/app/api/admin/[resource]/route";
import { moderate, getAdminRecords } from "@/lib/admin/service";
import { revalidatePath } from "next/cache";

vi.mock("@/lib/admin/service", () => ({ moderate: vi.fn(), getAdminRecords: vi.fn(), getAdminOverview: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(() => vi.clearAllMocks());
const url = "https://example.test/api/admin/moderation";
function request(origin = "https://example.test", body = "{}") {
  return new Request(url, { method: "POST", headers: { origin, "content-type": "application/json" }, body });
}
describe("admin HTTP boundary", () => {
  it("rejects cross-origin mutations before processing", async () => {
    expect((await POST(request("https://evil.test"))).status).toBe(403);
    expect(moderate).not.toHaveBeenCalled();
  });
  it("rejects missing origin", async () => {
    expect((await POST(new Request(url, { method: "POST" }))).status).toBe(403);
  });
  it("rejects malformed JSON", async () => {
    expect((await POST(request(undefined, "{"))).status).toBe(400);
  });
  it("returns authorization errors without invalidating pages", async () => {
    vi.mocked(moderate).mockResolvedValue({ error: "Unauthorized.", status: 401 });
    expect((await POST(request())).status).toBe(401);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
  it("refreshes dashboards and public listings after moderation", async () => {
    vi.mocked(moderate).mockResolvedValue({ data: { action: "hide" } });
    expect((await POST(request())).status).toBe(200);
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard", "layout");
    expect(revalidatePath).toHaveBeenCalledWith("/find-talent", "layout");
  });
  it("does not cache privileged data", async () => {
    vi.mocked(getAdminRecords).mockResolvedValue({ data: { items: [] } });
    const result = await GET(new Request("https://example.test/api/admin/users?page=2&filter=banned"), { params: Promise.resolve({ resource: "users" }) });
    expect(result.headers.get("cache-control")).toBe("private, no-store");
    expect(getAdminRecords).toHaveBeenCalledWith({}, { resource: "users", page: "2", filter: "banned" });
  });
});
