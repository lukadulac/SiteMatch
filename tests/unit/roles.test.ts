import { describe, expect, it } from "vitest";
import { getDashboardPath, isAppRole } from "@/lib/auth/roles";

describe("isAppRole", () => {
	it("accepts the three application roles", () => {
		for (const role of ["client", "provider", "admin"]) {
			expect(isAppRole(role)).toBe(true);
		}
	});

	it("rejects anything else, including near-misses", () => {
		for (const role of [null, undefined, "", "Admin", "CLIENT", "guest", 1, {}]) {
			expect(isAppRole(role)).toBe(false);
		}
	});
});

describe("getDashboardPath", () => {
	it("maps each role to its dashboard", () => {
		expect(getDashboardPath("client")).toBe("/dashboard/client");
		expect(getDashboardPath("provider")).toBe("/dashboard/provider");
		expect(getDashboardPath("admin")).toBe("/dashboard/admin");
	});
});
