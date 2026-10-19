import { describe, expect, it } from "vitest";
import { completeDashboardNavigation } from "@/components/dashboard/DashboardShell";

describe("completeDashboardNavigation", () => {
  it("keeps all client sections reachable from a partial page menu", () => {
    const items = completeDashboardNavigation([
      { href: "/dashboard/client", label: "Overview" },
      { href: "/dashboard/client/projects", label: "Projects", active: true, count: 4 },
      { href: "/dashboard/messages", label: "Messages", count: 2 },
    ]);

    expect(items.map((item) => item.href)).toEqual([
      "/dashboard/client",
      "/dashboard/client/projects",
      "/dashboard/client/service-requests",
      "/dashboard/client/workrooms",
      "/dashboard/messages",
      "/dashboard/client/profile",
    ]);
    expect(items[1]).toMatchObject({ active: true, count: 4 });
    expect(items[4]).toMatchObject({ count: 2 });
  });

  it("keeps provider service requests and workrooms in the menu", () => {
    const items = completeDashboardNavigation([
      { href: "/dashboard/provider", label: "Overview" },
      { href: "/dashboard/provider/applications", label: "Applications", active: true },
    ]);

    expect(items.map((item) => item.href)).toContain("/dashboard/provider/service-requests");
    expect(items.map((item) => item.href)).toContain("/dashboard/provider/workrooms");
  });
});
