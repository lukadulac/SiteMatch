import { describe, expect, it } from "vitest";
import {
	findActiveHref,
	getAdminNavigation,
	getBrowseItems,
	getWorkspaceItems,
	getWorkspaceLabel,
} from "@/lib/navigation/menu-items";

const NO_COUNTS = { unreadMessages: 0, pendingServiceRequests: 0 };

function activeHrefs(items: Array<{ href: string; active?: boolean }>) {
	return items.filter((item) => item.active).map((item) => item.href);
}

describe("findActiveHref", () => {
	const items = [{ href: "/dashboard/client" }, { href: "/dashboard/client/projects" }];

	it("prefers the longest matching prefix", () => {
		expect(findActiveHref(items, "/dashboard/client/projects")).toBe("/dashboard/client/projects");
		expect(findActiveHref(items, "/dashboard/client/projects/42")).toBe("/dashboard/client/projects");
		expect(findActiveHref(items, "/dashboard/client")).toBe("/dashboard/client");
	});

	it("matches whole path segments only", () => {
		expect(findActiveHref([{ href: "/jobs" }], "/jobsite")).toBeNull();
	});

	it("matches the extra prefixes an item owns", () => {
		const workrooms = [{ href: "/dashboard/client/workrooms", alsoMatches: ["/dashboard/workrooms"] }];
		expect(findActiveHref(workrooms, "/dashboard/workrooms/abc")).toBe("/dashboard/client/workrooms");
	});
});

describe("getBrowseItems", () => {
	it("marks the section the guest is on", () => {
		expect(activeHrefs(getBrowseItems("/find-talent/123"))).toEqual(["/find-talent"]);
		expect(activeHrefs(getBrowseItems("/"))).toEqual([]);
	});

	it("gives every row a description", () => {
		expect(getBrowseItems("/").every((item) => item.description)).toBe(true);
	});
});

describe("getWorkspaceItems", () => {
	it("leaves profile out of the drawer, since the profile card links there", () => {
		const hrefs = getWorkspaceItems("client", "/", NO_COUNTS).map((item) => item.href);

		expect(hrefs).toEqual([
			"/dashboard/client",
			"/dashboard/client/projects",
			"/dashboard/client/service-requests",
			"/dashboard/client/workrooms",
			"/dashboard/messages",
		]);
	});

	it("marks only the most specific section active", () => {
		expect(activeHrefs(getWorkspaceItems("client", "/dashboard/client/projects", NO_COUNTS))).toEqual([
			"/dashboard/client/projects",
		]);
	});

	it("marks shared detail pages under their role section", () => {
		expect(activeHrefs(getWorkspaceItems("provider", "/dashboard/service-requests/7", NO_COUNTS))).toEqual([
			"/dashboard/provider/service-requests",
		]);
	});

	it("puts unread messages and pending requests on their rows", () => {
		const items = getWorkspaceItems("provider", "/", { unreadMessages: 3, pendingServiceRequests: 2 });

		expect(items.find((item) => item.href === "/dashboard/messages")).toMatchObject({
			count: 3,
			countKind: "unread",
		});
		expect(items.find((item) => item.href === "/dashboard/provider/service-requests")).toMatchObject({
			count: 2,
			countKind: "pending",
		});
	});

	it("shows no badge for a zero count", () => {
		const items = getWorkspaceItems("client", "/", NO_COUNTS);
		expect(items.some((item) => "count" in item)).toBe(false);
	});

	it("gives admins their real sections under an Admin label", () => {
		expect(getWorkspaceItems("admin", "/", NO_COUNTS).map((item) => item.label)).toEqual([
			"Overview",
			"Users",
			"Service listings",
			"Projects",
			"Audit log",
		]);
		expect(getWorkspaceLabel("admin")).toBe("Admin");
		expect(getWorkspaceLabel("client")).toBe("Your workspace");
	});
});

describe("getAdminNavigation", () => {
	it("marks a resource page active instead of the overview", () => {
		expect(activeHrefs(getAdminNavigation("/dashboard/admin/users"))).toEqual(["/dashboard/admin/users"]);
		expect(activeHrefs(getAdminNavigation("/dashboard/admin"))).toEqual(["/dashboard/admin"]);
	});
});
