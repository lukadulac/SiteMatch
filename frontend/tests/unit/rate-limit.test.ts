import { afterEach, describe, expect, it, vi } from "vitest";
import {
	AUTH_RATE_LIMITS,
	checkAuthRateLimit,
	createRateLimitKey,
	getRequestIp,
	normalizeRateLimitEmail,
	recordAuthRateLimitAttempt,
	resetAuthRateLimit,
} from "@/lib/auth/rate-limit";
import { createSupabaseStub } from "../helpers/supabase-stub";

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("getRequestIp", () => {
	it("uses the first entry of x-forwarded-for", () => {
		const headers = new Headers({
			"x-forwarded-for": "203.0.113.5, 70.41.3.18, 150.172.238.178",
		});

		expect(getRequestIp(headers)).toBe("203.0.113.5");
	});

	it("trims whitespace around the forwarded address", () => {
		expect(getRequestIp(new Headers({ "x-forwarded-for": "  203.0.113.5  " }))).toBe(
			"203.0.113.5",
		);
	});

	it("falls back to x-real-ip, then cf-connecting-ip", () => {
		expect(getRequestIp(new Headers({ "x-real-ip": "198.51.100.7" }))).toBe(
			"198.51.100.7",
		);
		expect(
			getRequestIp(new Headers({ "cf-connecting-ip": "198.51.100.9" })),
		).toBe("198.51.100.9");
	});

	it("falls back to 'unknown' when no address header is present", () => {
		expect(getRequestIp(new Headers())).toBe("unknown");
	});

	it("ignores an empty forwarded header instead of returning a blank key", () => {
		expect(
			getRequestIp(
				new Headers({ "x-forwarded-for": "", "x-real-ip": "198.51.100.7" }),
			),
		).toBe("198.51.100.7");
	});
});

describe("normalizeRateLimitEmail", () => {
	it("trims and lowercases so casing cannot dodge the limiter", () => {
		expect(normalizeRateLimitEmail("  User@Example.COM ")).toBe(
			"user@example.com",
		);
	});
});

describe("createRateLimitKey", () => {
	it("is deterministic for the same parts", () => {
		vi.stubEnv("AUTH_RATE_LIMIT_SECRET", "test-secret");

		expect(createRateLimitKey(["login_ip", "203.0.113.5"])).toBe(
			createRateLimitKey(["login_ip", "203.0.113.5"]),
		);
	});

	it("separates scopes and inputs", () => {
		vi.stubEnv("AUTH_RATE_LIMIT_SECRET", "test-secret");

		expect(createRateLimitKey(["login_ip", "203.0.113.5"])).not.toBe(
			createRateLimitKey(["register_ip", "203.0.113.5"]),
		);
		expect(createRateLimitKey(["login_ip", "203.0.113.5"])).not.toBe(
			createRateLimitKey(["login_ip", "203.0.113.6"]),
		);
	});

	it("does not leak the raw input", () => {
		vi.stubEnv("AUTH_RATE_LIMIT_SECRET", "test-secret");

		const key = createRateLimitKey(["login_email_ip", "user@example.com"]);

		expect(key).not.toContain("user@example.com");
		expect(key).toMatch(/^[0-9a-f]{64}$/);
	});

	it("changes when the secret changes", () => {
		vi.stubEnv("AUTH_RATE_LIMIT_SECRET", "secret-a");
		const first = createRateLimitKey(["login_ip", "203.0.113.5"]);

		vi.stubEnv("AUTH_RATE_LIMIT_SECRET", "secret-b");

		expect(createRateLimitKey(["login_ip", "203.0.113.5"])).not.toBe(first);
	});

	it("throws in production when the secret is missing", () => {
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("AUTH_RATE_LIMIT_SECRET", "");

		expect(() => createRateLimitKey(["login_ip", "203.0.113.5"])).toThrow(
			/AUTH_RATE_LIMIT_SECRET/,
		);
	});

	it("falls back to a development secret outside production", () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.stubEnv("AUTH_RATE_LIMIT_SECRET", "");

		expect(() => createRateLimitKey(["login_ip", "203.0.113.5"])).not.toThrow();
	});
});

describe("AUTH_RATE_LIMITS", () => {
	it("keeps per-email login limits tighter than per-IP login limits", () => {
		expect(AUTH_RATE_LIMITS.loginEmailIp.maxAttempts).toBeLessThan(
			AUTH_RATE_LIMITS.loginIp.maxAttempts,
		);
	});

	it("configures every scope with a positive window and block duration", () => {
		for (const config of Object.values(AUTH_RATE_LIMITS)) {
			expect(config.maxAttempts).toBeGreaterThan(0);
			expect(config.windowSeconds).toBeGreaterThan(0);
			expect(config.blockSeconds).toBeGreaterThan(0);
		}
	});
});

describe("checkAuthRateLimit", () => {
	it("passes the scope and key through to the database function", async () => {
		const stub = createSupabaseStub({
			"rpc.auth_rate_limit_check": {
				data: [{ allowed: true, retry_after_seconds: 0 }],
			},
		});

		const result = await checkAuthRateLimit(stub.client, "login_ip", "hash-1");

		expect(result).toEqual({ allowed: true, retryAfterSeconds: 0 });
		expect(stub.callsFor("rpc.auth_rate_limit_check")[0]?.payload).toEqual({
			target_scope: "login_ip",
			target_key_hash: "hash-1",
		});
	});

	it("reports the retry delay when blocked", async () => {
		const stub = createSupabaseStub({
			"rpc.auth_rate_limit_check": {
				data: [{ allowed: false, retry_after_seconds: 900 }],
			},
		});

		expect(await checkAuthRateLimit(stub.client, "login_ip", "hash-1")).toEqual({
			allowed: false,
			retryAfterSeconds: 900,
		});
	});

	it("fails closed when the database call errors", async () => {
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
		const stub = createSupabaseStub({
			"rpc.auth_rate_limit_check": { error: { message: "boom" } },
		});

		const result = await checkAuthRateLimit(stub.client, "login_ip", "hash-1");

		expect(result.allowed).toBe(false);
		expect(consoleError).toHaveBeenCalled();
	});

	it("allows the request when the function returns no rows", async () => {
		const stub = createSupabaseStub({
			"rpc.auth_rate_limit_check": { data: [] },
		});

		expect(
			(await checkAuthRateLimit(stub.client, "login_ip", "hash-1")).allowed,
		).toBe(true);
	});
});

describe("recordAuthRateLimitAttempt", () => {
	it("forwards the full window configuration", async () => {
		const stub = createSupabaseStub({
			"rpc.auth_rate_limit_record_attempt": {
				data: [{ allowed: true, retry_after_seconds: 0 }],
			},
		});

		await recordAuthRateLimitAttempt(
			stub.client,
			AUTH_RATE_LIMITS.registerIp,
			"hash-2",
		);

		expect(
			stub.callsFor("rpc.auth_rate_limit_record_attempt")[0]?.payload,
		).toEqual({
			target_scope: AUTH_RATE_LIMITS.registerIp.scope,
			target_key_hash: "hash-2",
			max_attempts: AUTH_RATE_LIMITS.registerIp.maxAttempts,
			window_seconds: AUTH_RATE_LIMITS.registerIp.windowSeconds,
			block_seconds: AUTH_RATE_LIMITS.registerIp.blockSeconds,
		});
	});

	it("fails closed when the database call errors", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const stub = createSupabaseStub({
			"rpc.auth_rate_limit_record_attempt": { error: { message: "boom" } },
		});

		const result = await recordAuthRateLimitAttempt(
			stub.client,
			AUTH_RATE_LIMITS.loginIp,
			"hash-2",
		);

		expect(result.allowed).toBe(false);
	});
});

describe("resetAuthRateLimit", () => {
	it("clears the counter for the scope and key", async () => {
		const stub = createSupabaseStub({
			"rpc.auth_rate_limit_reset": { data: null },
		});

		await resetAuthRateLimit(stub.client, "login_email_ip", "hash-3");

		expect(stub.callsFor("rpc.auth_rate_limit_reset")[0]?.payload).toEqual({
			target_scope: "login_email_ip",
			target_key_hash: "hash-3",
		});
	});

	it("swallows database errors instead of blocking a successful login", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const stub = createSupabaseStub({
			"rpc.auth_rate_limit_reset": { error: { message: "boom" } },
		});

		await expect(
			resetAuthRateLimit(stub.client, "login_email_ip", "hash-3"),
		).resolves.toBeUndefined();
	});
});
