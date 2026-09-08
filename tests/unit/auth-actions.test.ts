import { beforeEach, describe, expect, it, vi } from "vitest";
import { loginAction, logoutAction, registerAction } from "@/app/(auth)/actions";
import { initialAuthActionState } from "@/app/(auth)/action-state";
import { ensureUserProfile } from "@/lib/auth/provision";
import {
	checkAuthRateLimit,
	recordAuthRateLimitAttempt,
	resetAuthRateLimit,
} from "@/lib/auth/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildFormData } from "../helpers/form-data";
import {
	createSupabaseStub,
	stubUser,
	type AuthStubOptions,
} from "../helpers/supabase-stub";

vi.mock("next/navigation", () => ({
	redirect: (path: string) => {
		throw new Error(`NEXT_REDIRECT:${path}`);
	},
}));

vi.mock("next/headers", () => ({
	headers: async () => new Headers({ "x-forwarded-for": "203.0.113.5" }),
}));

vi.mock("@/lib/supabase/server", () => ({
	createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/auth/provision", () => ({
	ensureUserProfile: vi.fn(),
}));

vi.mock("@/lib/auth/rate-limit", async () => {
	const actual =
		await vi.importActual<typeof import("@/lib/auth/rate-limit")>(
			"@/lib/auth/rate-limit",
		);

	return {
		...actual,
		createRateLimitKey: (parts: string[]) => parts.join("|"),
		checkAuthRateLimit: vi.fn(),
		recordAuthRateLimitAttempt: vi.fn(),
		resetAuthRateLimit: vi.fn(),
	};
});

const ALLOWED = { allowed: true, retryAfterSeconds: 0 };
const BLOCKED = { allowed: false, retryAfterSeconds: 900 };

function arrangeSupabase(auth: AuthStubOptions = {}) {
	const stub = createSupabaseStub({}, auth);

	vi.mocked(createSupabaseServerClient).mockResolvedValue(stub.client);

	return stub;
}

/** Runs an action that is expected to redirect and returns the target path. */
async function expectRedirect(action: Promise<unknown>) {
	try {
		await action;
	} catch (error) {
		const message = error instanceof Error ? error.message : "";

		if (message.startsWith("NEXT_REDIRECT:")) {
			return message.slice("NEXT_REDIRECT:".length);
		}

		throw error;
	}

	throw new Error("expected the action to redirect");
}

function loginForm(overrides: Record<string, string> = {}) {
	return buildFormData({
		email: "ana@example.com",
		password: "correct-horse",
		...overrides,
	});
}

function registerForm(overrides: Record<string, string | string[]> = {}) {
	return buildFormData({
		full_name: "Ana Petrovic",
		email: "ana@example.com",
		phone: "+381 60 123 4567",
		country: "Serbia",
		city: "Novi Sad",
		password: "correct-horse",
		role: "client",
		business_name: "Dulac Studio",
		business_type: "local_service",
		project_idea: "We want a booking site for our two salon locations.",
		interested_solution_types: ["business_website"],
		...overrides,
	});
}

beforeEach(() => {
	vi.mocked(checkAuthRateLimit).mockResolvedValue(ALLOWED);
	vi.mocked(recordAuthRateLimitAttempt).mockResolvedValue(ALLOWED);
	vi.mocked(resetAuthRateLimit).mockResolvedValue(undefined);
	vi.mocked(ensureUserProfile).mockResolvedValue({ role: "client" });
});

describe("loginAction", () => {
	it("reports an invalid email without touching the database", async () => {
		const stub = arrangeSupabase();

		const state = await loginAction(
			initialAuthActionState,
			loginForm({ email: "not-an-email" }),
		);

		expect(state.fieldErrors).toHaveProperty("email");
		expect(stub.callKeys()).not.toContain("auth.signInWithPassword");
	});

	it("requires a password", async () => {
		arrangeSupabase();

		const state = await loginAction(
			initialAuthActionState,
			loginForm({ password: "" }),
		);

		expect(state.fieldErrors).toHaveProperty("password");
	});

	it("echoes the submitted email back but never the password", async () => {
		arrangeSupabase();

		const state = await loginAction(
			initialAuthActionState,
			loginForm({ email: "not-an-email" }),
		);

		expect(state.fields).toEqual({ email: "not-an-email" });
	});

	it("blocks a rate-limited attempt with the same message as a wrong password", async () => {
		vi.mocked(checkAuthRateLimit).mockResolvedValueOnce(BLOCKED);
		const stub = arrangeSupabase();

		const state = await loginAction(initialAuthActionState, loginForm());

		expect(state.formError).toBe("Invalid email or password.");
		expect(stub.callKeys()).not.toContain("auth.signInWithPassword");
	});

	it("blocks when the per-IP limiter trips even if the per-email one allows", async () => {
		vi.mocked(checkAuthRateLimit)
			.mockResolvedValueOnce(ALLOWED)
			.mockResolvedValueOnce(BLOCKED);
		const stub = arrangeSupabase();

		const state = await loginAction(initialAuthActionState, loginForm());

		expect(state.formError).toBe("Invalid email or password.");
		expect(stub.callKeys()).not.toContain("auth.signInWithPassword");
	});

	it("records a failed attempt against both the email and the IP scope", async () => {
		arrangeSupabase({ signInWithPassword: { error: { message: "bad password" } } });

		const state = await loginAction(initialAuthActionState, loginForm());

		expect(state.formError).toBe("Invalid email or password.");
		expect(recordAuthRateLimitAttempt).toHaveBeenCalledTimes(2);
	});

	it("does not leak whether the account exists", async () => {
		arrangeSupabase({
			signInWithPassword: { error: { message: "Invalid login credentials" } },
		});

		const state = await loginAction(initialAuthActionState, loginForm());

		expect(state.formError).toBe("Invalid email or password.");
		expect(state.fieldErrors).toEqual({});
	});

	it("clears the per-email counter and lands the user on their dashboard", async () => {
		arrangeSupabase({ user: stubUser({ id: "user-1" }) });
		vi.mocked(ensureUserProfile).mockResolvedValue({ role: "provider" });

		const path = await expectRedirect(
			loginAction(initialAuthActionState, loginForm()),
		);

		expect(path).toBe("/dashboard/provider");
		expect(resetAuthRateLimit).toHaveBeenCalledTimes(1);
		expect(recordAuthRateLimitAttempt).not.toHaveBeenCalled();
	});

	it("reports a session that could not be established", async () => {
		arrangeSupabase({ user: null });

		const state = await loginAction(initialAuthActionState, loginForm());

		expect(state.formError).toMatch(/session/i);
		expect(ensureUserProfile).not.toHaveBeenCalled();
	});

	it("signs the user back out when the marketplace profile is unusable", async () => {
		const stub = arrangeSupabase({ user: stubUser({ id: "user-1" }) });
		vi.mocked(ensureUserProfile).mockResolvedValue({
			error: "Your account is missing a valid role.",
		});

		const state = await loginAction(initialAuthActionState, loginForm());

		expect(state.formError).toBe("Your account is missing a valid role.");
		expect(stub.callKeys()).toContain("auth.signOut");
	});
});

describe("registerAction", () => {
	it("asks for a role when none was chosen", async () => {
		arrangeSupabase();

		const state = await registerAction(
			initialAuthActionState,
			registerForm({ role: "" }),
		);

		expect(state.fieldErrors).toHaveProperty("role");
	});

	it("rejects an unknown role", async () => {
		arrangeSupabase();

		const state = await registerAction(
			initialAuthActionState,
			registerForm({ role: "admin" }),
		);

		expect(state.fieldErrors).toHaveProperty("role");
	});

	it("validates the role-specific profile before signing anyone up", async () => {
		const stub = arrangeSupabase();

		const state = await registerAction(
			initialAuthActionState,
			registerForm({ project_idea: "too short" }),
		);

		expect(state.fieldErrors).toHaveProperty("project_idea");
		expect(stub.callKeys()).not.toContain("auth.signUp");
	});

	it("validates the account fields", async () => {
		arrangeSupabase();

		const state = await registerAction(
			initialAuthActionState,
			registerForm({ phone: "12", password: "short" }),
		);

		expect(state.fieldErrors).toHaveProperty("phone");
		expect(state.fieldErrors).toHaveProperty("password");
	});

	it("blocks a rate-limited signup before creating an account", async () => {
		vi.mocked(recordAuthRateLimitAttempt).mockResolvedValue(BLOCKED);
		const stub = arrangeSupabase();

		const state = await registerAction(initialAuthActionState, registerForm());

		expect(state.formError).toBe(
			"We could not create your account. Please try again.",
		);
		expect(stub.callKeys()).not.toContain("auth.signUp");
	});

	it("reports a signup failure generically", async () => {
		arrangeSupabase({ signUp: { error: { message: "User already registered" } } });

		const state = await registerAction(initialAuthActionState, registerForm());

		expect(state.formError).toBe(
			"We could not create your account. Please try again.",
		);
		expect(ensureUserProfile).not.toHaveBeenCalled();
	});

	it("asks the user to confirm their email when no session was issued", async () => {
		arrangeSupabase({
			signUp: { data: { user: { id: "user-1" }, session: null } },
		});

		const state = await registerAction(initialAuthActionState, registerForm());

		expect(state.formSuccess).toMatch(/confirm your email/i);
		expect(state.fields).toEqual({ email: "ana@example.com" });
		expect(ensureUserProfile).not.toHaveBeenCalled();
	});

	it("provisions the profile and lands the user on their dashboard", async () => {
		arrangeSupabase({
			signUp: {
				data: { user: { id: "user-1" }, session: { access_token: "token" } },
			},
		});

		const path = await expectRedirect(
			registerAction(initialAuthActionState, registerForm()),
		);

		expect(path).toBe("/dashboard/client");
		expect(ensureUserProfile).toHaveBeenCalledTimes(1);
	});

	it("signs the half-created account out when provisioning fails", async () => {
		const stub = arrangeSupabase({
			signUp: {
				data: { user: { id: "user-1" }, session: { access_token: "token" } },
			},
		});
		vi.mocked(ensureUserProfile).mockResolvedValue({ error: "column missing" });
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

		const state = await registerAction(initialAuthActionState, registerForm());

		expect(state.formError).toBe(
			"We could not finish creating your account. Please try again.",
		);
		expect(stub.callKeys()).toContain("auth.signOut");
		expect(consoleError).toHaveBeenCalled();
	});

	it("keeps the submitted values so the form can be re-rendered", async () => {
		arrangeSupabase();

		const state = await registerAction(
			initialAuthActionState,
			registerForm({ project_idea: "too short" }),
		);

		expect(state.fields).toMatchObject({
			full_name: "Ana Petrovic",
			email: "ana@example.com",
			business_name: "Dulac Studio",
		});
		expect(state.fields).not.toHaveProperty("password");
	});
});

describe("logoutAction", () => {
	it("ends the session and returns to the login page", async () => {
		const stub = arrangeSupabase();

		const path = await expectRedirect(logoutAction());

		expect(path).toBe("/login");
		expect(stub.callKeys()).toContain("auth.signOut");
	});
});
