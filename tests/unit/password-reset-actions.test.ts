import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialAuthActionState } from "@/app/(auth)/action-state";
import { requestPasswordResetAction } from "@/app/(auth)/password-reset-actions";
import { recordAuthRateLimitAttempt } from "@/lib/auth/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildFormData } from "../helpers/form-data";
import { createSupabaseStub } from "../helpers/supabase-stub";

vi.mock("next/headers", () => ({
	headers: async () => new Headers({ "x-forwarded-for": "203.0.113.5", origin: "https://evil.com" }),
}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("@/lib/auth/rate-limit", async () => ({
	...(await vi.importActual<typeof import("@/lib/auth/rate-limit")>("@/lib/auth/rate-limit")),
	recordAuthRateLimitAttempt: vi.fn(),
}));

beforeEach(() => {
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
