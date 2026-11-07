import { describe, expect, it } from "vitest";
import { parseEnv } from "../../src/config/env.js";

const valid = {
	SUPABASE_URL: "https://project.supabase.co",
	SUPABASE_PUBLISHABLE_KEY: "publishable",
	INTERNAL_API_SECRET: "a".repeat(32),
	SITE_URL: "https://workbridge.test",
	FRONTEND_ORIGINS: "https://workbridge.test/, http://localhost:3000",
};

describe("parseEnv", () => {
	it("applies defaults and normalises lists", () => {
		const env = parseEnv(valid);

		expect(env.PORT).toBe(4000);
		expect(env.TRUST_PROXY_HOPS).toBe(1);
		expect(env.INTERNAL_API_SECRET).toEqual(["a".repeat(32)]);
		expect(env.FRONTEND_ORIGINS).toEqual(["https://workbridge.test", "http://localhost:3000"]);
		expect(env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
	});

	it("treats an empty optional secret as missing", () => {
		expect(parseEnv({ ...valid, SUPABASE_SERVICE_ROLE_KEY: "" }).SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
	});

	it("rejects an internal secret shorter than 32 characters", () => {
		expect(() => parseEnv({ ...valid, INTERNAL_API_SECRET: "short" })).toThrow("INTERNAL_API_SECRET");
	});

	it("names the missing variables without printing any value", () => {
		const secret = "b".repeat(40);
		let message = "";

		try {
			parseEnv({ INTERNAL_API_SECRET: secret, SITE_URL: "not a url" });
		} catch (error) {
			message = (error as Error).message;
		}

		expect(message).toContain("SUPABASE_URL");
		expect(message).toContain("SITE_URL");
		expect(message).toContain("FRONTEND_ORIGINS");
		expect(message).not.toContain(secret);
	});
});
