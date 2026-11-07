import { describe, expect, it } from "vitest";
import { getLoginHref, getSafeReturnPath } from "@/lib/auth/return-url";

describe("getSafeReturnPath", () => {
	it.each([
		["/", "/"],
		["/find-talent/123", "/find-talent/123"],
		["/jobs/123?tab=details", "/jobs/123?tab=details"],
		["/profile#portfolio", "/profile#portfolio"],
		["  /jobs/123  ", "/jobs/123"],
	])("accepts local return path %s", (input, expected) => {
		expect(getSafeReturnPath(input)).toBe(expected);
	});

	it.each([
		"https://evil.com",
		"http://evil.com",
		"//evil.com",
		"/login",
		"/login/",
		"/login?next=/jobs/123",
		"",
		null,
		undefined,
		"jobs/123",
		"/\\evil.com",
		"/%5Cevil.com",
		"/%2F%2Fevil.com",
		"/jobs/%",
		"/jobs/%00",
	])("rejects unsafe return path %s", (input) => {
		expect(getSafeReturnPath(input)).toBeNull();
	});
});

describe("getLoginHref", () => {
	it("adds an encoded next parameter for safe return paths", () => {
		expect(getLoginHref("/jobs/123?tab=details")).toBe(
			"/login?next=%2Fjobs%2F123%3Ftab%3Ddetails",
		);
	});

	it("falls back to plain login when the return path is unsafe", () => {
		expect(getLoginHref("https://evil.com")).toBe("/login");
	});
});
