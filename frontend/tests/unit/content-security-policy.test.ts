import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, createNonce } from "@/lib/security/content-security-policy";

function directives(policy: string) {
	return Object.fromEntries(policy.split("; ").map((directive) => {
		const [name, ...values] = directive.split(" ");
		return [name, values.join(" ")];
	}));
}

describe("buildContentSecurityPolicy", () => {
	it("only runs scripts that carry this request's nonce in production", () => {
		const policy = directives(buildContentSecurityPolicy("abc", { supabaseUrl: "https://xyz.supabase.co", isDev: false }));

		expect(policy["script-src"]).toBe("'self' 'nonce-abc' 'strict-dynamic'");
		expect(policy["object-src"]).toBe("'none'");
		expect(policy["frame-ancestors"]).toBe("'none'");
		expect(policy["base-uri"]).toBe("'self'");
		expect(policy["form-action"]).toBe("'self'");
		expect(policy).toHaveProperty("upgrade-insecure-requests");
	});

	it("allows Supabase for avatars, the API and Realtime, and nothing else", () => {
		const policy = directives(buildContentSecurityPolicy("abc", { supabaseUrl: "https://xyz.supabase.co/", isDev: false }));

		expect(policy["img-src"]).toBe("'self' blob: data: https://xyz.supabase.co");
		expect(policy["connect-src"]).toBe("'self' https://xyz.supabase.co wss://xyz.supabase.co");
	});

	it("adds what the dev server needs only in development", () => {
		const policy = directives(buildContentSecurityPolicy("abc", { supabaseUrl: "http://127.0.0.1:54321", isDev: true }));

		expect(policy["script-src"]).toContain("'unsafe-eval'");
		expect(policy["connect-src"]).toBe("'self' http://127.0.0.1:54321 ws://127.0.0.1:54321 ws:");
		expect(policy).not.toHaveProperty("upgrade-insecure-requests");
	});

	it("makes a different nonce every time", () => {
		expect(createNonce()).not.toBe(createNonce());
	});
});
