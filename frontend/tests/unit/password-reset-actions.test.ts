import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialAuthActionState } from "@/app/(auth)/action-state";
import { requestPasswordResetAction, resetPasswordAction } from "@/app/(auth)/password-reset-actions";
import { recordAuthRateLimitAttempt } from "@/lib/auth/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildFormData } from "../helpers/form-data";
import { expectRedirect } from "../helpers/redirect";
import { createSupabaseStub } from "../helpers/supabase-stub";

const cookieJar = new Map<string, string>();
const deletedCookies: unknown[] = [];

vi.mock("next/headers", () => ({
	headers: async () => new Headers({ "x-forwarded-for": "203.0.113.5", origin: "https://evil.com" }),
	cookies: async () => ({
		get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined),
		delete: (options: unknown) => deletedCookies.push(options),
	}),
}));
vi.mock("next/navigation", () => ({
	redirect: (path: string) => {
		throw new Error(`NEXT_REDIRECT:${path}`);
	},
}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("@/lib/auth/rate-limit", async () => ({
	...(await vi.importActual<typeof import("@/lib/auth/rate-limit")>("@/lib/auth/rate-limit")),
	recordAuthRateLimitAttempt: vi.fn(),
}));

beforeEach(() => {
	cookieJar.clear();
	deletedCookies.length = 0;
	vi.spyOn(console, "warn").mockImplementation(() => {});
	vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://staging.example.com");
	vi.mocked(recordAuthRateLimitAttempt).mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
});

describe("requestPasswordResetAction", () => {
	it("validates the email before calling Supabase", async () => {
		const result = await requestPasswordResetAction(initialAuthActionState, buildFormData({ email: "not-an-email" }));

		expect(result.fieldErrors?.email).toBeDefined();
		expect(createSupabaseServerClient).not.toHaveBeenCalled();
	});

	it("asks Supabase for a recovery email that returns to this site's callback", async () => {
		const stub = createSupabaseStub();
		vi.mocked(createSupabaseServerClient).mockResolvedValue(stub.client);

		const result = await requestPasswordResetAction(
			initialAuthActionState,
			buildFormData({ email: " ana@example.com ", next: "/jobs/123" }),
		);

		expect(stub.callsFor("auth.resetPasswordForEmail")[0]?.payload).toEqual({
			email: "ana@example.com",
			options: { redirectTo: "https://staging.example.com/auth/recovery?next=%2Fjobs%2F123" },
		});
		expect(result.formSuccess).toBeDefined();
		expect(result.formError).toBeUndefined();
	});

	it("never takes the redirect from request headers or an unsafe next", async () => {
		const stub = createSupabaseStub();
		vi.mocked(createSupabaseServerClient).mockResolvedValue(stub.client);

		await requestPasswordResetAction(
			initialAuthActionState,
			buildFormData({ email: "ana@example.com", next: "https://evil.com/steal" }),
		);

		expect(stub.callsFor("auth.resetPasswordForEmail")[0]?.payload).toMatchObject({
			options: { redirectTo: "https://staging.example.com/auth/recovery?next=" },
		});
	});

	it("gives known, unknown and failing addresses the same response", async () => {
		const responses = new Set<string | undefined>();

		for (const error of [null, { message: "User not found" }, { message: "SMTP unavailable", code: "unexpected_failure" }]) {
			const stub = createSupabaseStub({}, { resetPasswordForEmail: { error } });
			vi.mocked(createSupabaseServerClient).mockResolvedValue(stub.client);

			const result = await requestPasswordResetAction(
				initialAuthActionState,
				buildFormData({ email: "ana@example.com" }),
			);

			responses.add(result.formSuccess);
			expect(result.formError).toBeUndefined();
		}

		expect(responses.size).toBe(1);
		expect([...responses][0]).toMatch(/check your inbox/i);
	});

	it("answers a throttled request the same way and sends nothing", async () => {
		const stub = createSupabaseStub();
		vi.mocked(createSupabaseServerClient).mockResolvedValue(stub.client);
		vi.mocked(recordAuthRateLimitAttempt).mockResolvedValue({ allowed: false, retryAfterSeconds: 900 });

		const result = await requestPasswordResetAction(
			initialAuthActionState,
			buildFormData({ email: "ana@example.com" }),
		);

		expect(stub.callKeys()).not.toContain("auth.resetPasswordForEmail");
		expect(result.formSuccess).toMatch(/check your inbox/i);
	});

	it("shares the signup rate-limit budget, keyed by the caller's IP", async () => {
		const stub = createSupabaseStub();
		vi.mocked(createSupabaseServerClient).mockResolvedValue(stub.client);

		await requestPasswordResetAction(initialAuthActionState, buildFormData({ email: "ana@example.com" }));

		const [, limit, key] = vi.mocked(recordAuthRateLimitAttempt).mock.calls[0];

		expect(limit.scope).toBe("register_ip");
		expect(key).not.toContain("203.0.113.5");
	});

	it("reports a temporary failure when the site URL is misconfigured", async () => {
		vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://not-https.example.com");

		const result = await requestPasswordResetAction(
			initialAuthActionState,
			buildFormData({ email: "ana@example.com" }),
		);

		expect(result.formError).toMatch(/temporarily unavailable/i);
	});
});

describe("resetPasswordAction", () => {
	const user = { id: "user-1", email: "ana@example.com" };
	const valid = { password: "a-new-password", confirmPassword: "a-new-password" };

	it("rejects short or mismatched passwords without touching the account", async () => {
		const stub = createSupabaseStub({}, { user });
		vi.mocked(createSupabaseServerClient).mockResolvedValue(stub.client);
		cookieJar.set("wb_recovery", user.id);

		const short = await resetPasswordAction(initialAuthActionState, buildFormData({ password: "short", confirmPassword: "short" }));
		const mismatch = await resetPasswordAction(initialAuthActionState, buildFormData({ password: "a-new-password", confirmPassword: "different-one" }));

		expect(short.fieldErrors?.password).toBeDefined();
		expect(mismatch.fieldErrors?.confirmPassword).toEqual(["Passwords do not match."]);
		expect(stub.callKeys()).not.toContain("auth.updateUser");
	});

	it("refuses without the recovery marker, or with another user's marker", async () => {
		const stub = createSupabaseStub({}, { user });
		vi.mocked(createSupabaseServerClient).mockResolvedValue(stub.client);

		expect(await expectRedirect(resetPasswordAction(initialAuthActionState, buildFormData(valid)))).toBe("/forgot-password?error=link");
		cookieJar.set("wb_recovery", "someone-else");
		expect(await expectRedirect(resetPasswordAction(initialAuthActionState, buildFormData(valid)))).toBe("/forgot-password?error=link");
		expect(stub.callKeys()).not.toContain("auth.updateUser");
	});

	it("saves the password, signs out every session and sends the user to sign in", async () => {
		const stub = createSupabaseStub({}, { user });
		vi.mocked(createSupabaseServerClient).mockResolvedValue(stub.client);
		cookieJar.set("wb_recovery", user.id);

		const target = await expectRedirect(
			resetPasswordAction(initialAuthActionState, buildFormData({ ...valid, next: "/jobs/123" })),
		);

		expect(stub.callsFor("auth.updateUser")[0]?.payload).toEqual({ password: "a-new-password" });
		expect(stub.callsFor("auth.signOut")[0]?.payload).toEqual({ scope: "global" });
		expect(deletedCookies).toEqual([{ name: "wb_recovery", path: "/reset-password" }]);
		expect(target).toBe("/login?next=%2Fjobs%2F123&reset=1");
	});

	it("explains a reused password and keeps the session", async () => {
		const stub = createSupabaseStub({}, { user, updateUser: { error: { message: "same", code: "same_password" } } });
		vi.mocked(createSupabaseServerClient).mockResolvedValue(stub.client);
		cookieJar.set("wb_recovery", user.id);

		const result = await resetPasswordAction(initialAuthActionState, buildFormData(valid));

		expect(result.fieldErrors?.password?.[0]).toMatch(/not used before/);
		expect(stub.callKeys()).not.toContain("auth.signOut");
	});
});
