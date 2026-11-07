import { describe, expect, it } from "vitest";
import { getAuthCookieName } from "../../src/contracts/auth/cookie-name.js";

describe("getAuthCookieName", () => {
	it("matches the storage key @supabase/ssr uses", () => {
		expect(getAuthCookieName("https://fnbpwevsubtcdnrfjjak.supabase.co")).toBe("sb-fnbpwevsubtcdnrfjjak-auth-token");
		expect(getAuthCookieName("http://127.0.0.1:54321")).toBe("sb-127-auth-token");
	});

	it("differs between localhost and 127.0.0.1, which is why both sides need the same URL", () => {
		expect(getAuthCookieName("http://localhost:54321")).not.toBe(getAuthCookieName("http://127.0.0.1:54321"));
	});
});
