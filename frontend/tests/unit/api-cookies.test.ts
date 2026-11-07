import { afterEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { applySetCookies, isCookieRemoval, parseSetCookie } from "@/lib/api/cookies";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

afterEach(() => {
	vi.mocked(cookies).mockReset();
});

// The value @supabase/ssr writes: "base64-" plus base64url, split into 3180-character chunks.
const chunk = (index: number) => `base64-${"eyJhY2Nlc3NfdG9rZW4iOi".repeat(140)}${index}`;

describe("parseSetCookie", () => {
	it("reads the attributes @supabase/ssr sends", () => {
		expect(
			parseSetCookie("sb-project-auth-token.0=abc; Path=/; Max-Age=34560000; SameSite=Lax; HttpOnly; Secure"),
		).toEqual({
			name: "sb-project-auth-token.0",
			value: "abc",
			options: { path: "/", maxAge: 34560000, sameSite: "lax", httpOnly: true, secure: true },
		});
	});

	it("keeps a path-scoped cookie's path", () => {
		expect(parseSetCookie("wb_recovery=user-1; Path=/reset-password; HttpOnly")?.options.path).toBe("/reset-password");
	});

	it("recognises a cleared cookie", () => {
		const cleared = parseSetCookie("sb-project-auth-token=; Path=/; Max-Age=0");
		const expired = parseSetCookie("sb-project-auth-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT");

		expect(cleared && isCookieRemoval(cleared)).toBe(true);
		expect(expired && isCookieRemoval(expired)).toBe(true);
		expect(isCookieRemoval(parseSetCookie("a=1; Max-Age=60")!)).toBe(false);
	});

	it("round-trips values: decoded once here, encoded once by Next.js", () => {
		for (const value of [chunk(0), chunk(1), "a b=c;d", "šđč"]) {
			const line = `sb-project-auth-token.0=${encodeURIComponent(value)}; Path=/`;
			const parsed = parseSetCookie(line)!;
			const response = NextResponse.next();

			response.cookies.set(parsed.name, parsed.value, parsed.options);

			expect(parsed.value).toBe(value);
			expect(response.headers.get("set-cookie")).toContain(`sb-project-auth-token.0=${encodeURIComponent(value)}`);
		}
	});

	it("ignores a line without a name", () => {
		expect(parseSetCookie("=value")).toBeNull();
	});
});

describe("applySetCookies", () => {
	it("stores every chunk through cookies()", async () => {
		const set = vi.fn();
		vi.mocked(cookies).mockResolvedValue({ set } as never);

		await applySetCookies([
			`sb-project-auth-token.0=${chunk(0)}; Path=/; SameSite=Lax`,
			`sb-project-auth-token.1=${chunk(1)}; Path=/; SameSite=Lax`,
		]);

		expect(set).toHaveBeenCalledTimes(2);
		expect(set).toHaveBeenCalledWith("sb-project-auth-token.1", chunk(1), { path: "/", sameSite: "lax" });
	});

	it("does not throw in a Server Component, where cookies are read-only", async () => {
		const set = vi.fn(() => {
			throw new Error("Cookies can only be modified in a Server Action or Route Handler.");
		});
		vi.mocked(cookies).mockResolvedValue({ set } as never);

		await expect(applySetCookies(["sb-project-auth-token=x; Path=/"])).resolves.toBeUndefined();
	});

	it("does nothing without Set-Cookie lines", async () => {
		await applySetCookies([]);

		expect(cookies).not.toHaveBeenCalled();
	});
});
