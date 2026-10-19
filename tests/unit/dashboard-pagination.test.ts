import { describe, expect, it } from "vitest";
import {
  dashboardListHref,
  parseDashboardPage,
  parseDashboardStatus,
} from "@/components/dashboard/DashboardListControls";
import { getJobsPageHref, parseJobsPage } from "@/lib/projects/jobs-pagination";

describe("dashboard list pagination", () => {
  it("normalizes invalid page and status values", () => {
    for (const value of [undefined, ["2"], "0", "-1", "1.5", "abc", "9007199254740992"]) {
      expect(parseDashboardPage(value)).toBe(1);
    }

    expect(parseDashboardPage("2")).toBe(2);
    expect(parseDashboardStatus("pending", ["all", "pending"] as const)).toBe("pending");
    expect(parseDashboardStatus("unknown", ["all", "pending"] as const)).toBe("all");
  });

  it("preserves status when changing pages", () => {
    expect(dashboardListHref("/dashboard/client/projects", "published", 2)).toBe(
      "/dashboard/client/projects?status=published&page=2",
    );
    expect(dashboardListHref("/dashboard/client/projects", "all", 1)).toBe(
      "/dashboard/client/projects",
    );
  });
});

describe("jobs pagination", () => {
  it("normalizes invalid page values", () => {
    expect(parseJobsPage("0")).toBe(1);
    expect(parseJobsPage("-2")).toBe(1);
    expect(parseJobsPage(["2"])).toBe(1);
    expect(parseJobsPage("3")).toBe(3);
  });

  it("preserves search and filters in page links", () => {
    expect(getJobsPageHref({ q: "web app", budget: "fixed", scope: "small", sort: "oldest" }, 2)).toBe(
      "/jobs?q=web+app&budget=fixed&scope=small&sort=oldest&page=2",
    );
  });
});
