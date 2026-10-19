import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import AdminLayout from "@/app/dashboard/admin/layout";
import AdminDashboardPage from "@/app/dashboard/admin/page";
import AdminRecordsPage from "@/app/dashboard/admin/[resource]/page";
import { getAdminOverview, getAdminRecords, requireAdmin } from "@/lib/admin/service";

vi.mock("@/lib/admin/service", () => ({ requireAdmin: vi.fn(), getAdminRecords: vi.fn(), getAdminOverview: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn().mockResolvedValue({}) }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }),
  notFound: vi.fn(() => { throw new Error("notFound"); }),
  usePathname: vi.fn(() => "/dashboard/admin"),
}));

describe("admin page boundary", () => {
  it("sends guests through the login return flow", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ error: "Unauthorized.", status: 401 });
    await expect(AdminLayout({ children: null })).rejects.toThrow("redirect:/login?next=%2Fdashboard%2Fadmin");
  });

  it("does not render the console for non-admins", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ error: "Admin access required.", status: 403 });
    await expect(AdminLayout({ children: null })).rejects.toThrow("notFound");
  });

  it("rejects unknown resources and canonicalizes invalid list parameters", async () => {
    await expect(AdminRecordsPage({ params: Promise.resolve({ resource: "settings" }), searchParams: Promise.resolve({}) })).rejects.toThrow("notFound");
    await expect(AdminRecordsPage({ params: Promise.resolve({ resource: "users" }), searchParams: Promise.resolve({ filter: "hidden", page: "-1" }) })).rejects.toThrow("redirect:/dashboard/admin/users");
    expect(getAdminRecords).not.toHaveBeenCalled();
  });

  it("redirects an out-of-range page while preserving the filter", async () => {
    vi.mocked(getAdminRecords).mockResolvedValue({ data: { items: [], totalCount: 21, page: 10, pageSize: 20 } });
    await expect(AdminRecordsPage({ params: Promise.resolve({ resource: "audit" }), searchParams: Promise.resolve({ page: "10" }) })).rejects.toThrow("redirect:/dashboard/admin/audit?page=2");
  });

  it("renders only real overview metrics", async () => {
    vi.mocked(getAdminOverview).mockResolvedValue({ data: {
      users: 4, projects: 3, services: 2, hiddenProjects: 1, hiddenServices: 0, pendingAuthDeletions: 0,
    } });
    vi.mocked(getAdminRecords).mockResolvedValue({ data: { items: [], totalCount: 0, page: 1, pageSize: 20 } });
    const html = renderToStaticMarkup(await AdminDashboardPage());
    expect(html).toContain("Operations overview");
    expect(html).toContain("Hidden projects");
    expect(html).not.toContain("Escrow");
  });

  it("renders a filtered empty state with disabled pagination", async () => {
    vi.mocked(getAdminRecords).mockResolvedValue({ data: { items: [], totalCount: 0, page: 1, pageSize: 20 } });
    const html = renderToStaticMarkup(await AdminRecordsPage({
      params: Promise.resolve({ resource: "audit" }), searchParams: Promise.resolve({}),
    }));
    expect(html).toContain("No moderation decisions yet");
    expect(html).toContain("Page 1 of 1");
    expect(html).toContain('aria-disabled="true"');
  });
});
