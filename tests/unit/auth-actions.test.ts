import { beforeEach, describe, expect, it, vi } from "vitest";
import { loginAction, logoutAction, registerAction } from "@/app/(auth)/actions";
import { initialAuthActionState } from "@/app/(auth)/action-state";
import { clientSolutionTypes } from "@/lib/auth/client-profile";
import { providerServiceCategories } from "@/lib/auth/provider-profile";
import { ensureUserProfile } from "@/lib/auth/provision";
import {
	checkAuthRateLimit,
	recordAuthRateLimitAttempt,
	resetAuthRateLimit,
} from "@/lib/auth/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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

vi.mock("@/lib/supabase/admin", () => ({
	createSupabaseAdminClient: vi.fn(),
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
	const stub = createSupabaseStub({ "rpc.is_account_enabled": { data: true } }, {
		...auth,
		user: auth.user ? { email_confirmed_at: "2026-10-01T12:00:00Z", ...auth.user } : auth.user,
	});

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
	vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
	vi.mocked(checkAuthRateLimit).mockResolvedValue(ALLOWED);
	vi.mocked(recordAuthRateLimitAttempt).mockResolvedValue(ALLOWED);
	vi.mocked(resetAuthRateLimit).mockResolvedValue(undefined);
	vi.mocked(ensureUserProfile).mockResolvedValue({ role: "client" });
});

describe("loginAction", () => {
	it("rejects a blocked account even with a valid password and next URL", async () => {
		const stub = createSupabaseStub({ "rpc.is_account_enabled": { data: false } }, {
			user: stubUser({ email_confirmed_at: "2026-10-01T00:00:00Z" }),
		});
		vi.mocked(createSupabaseServerClient).mockResolvedValue(stub.client);
		const result = await loginAction(initialAuthActionState, loginForm({ next: "/jobs/123" }));
		expect(result.formError).toBe("Your account is currently unavailable.");
		expect(stub.callKeys()).toContain("auth.signOut");
	});
	it("signs an unverified session out before provisioning or redirecting", async () => {
		const stub = arrangeSupabase({ user: stubUser({ email_confirmed_at: undefined }) });
		const state = await loginAction(initialAuthActionState, loginForm({ next: "/jobs/123" }));
		expect(state.verificationRequired).toBe(true);
		expect(stub.callKeys()).toContain("auth.signOut");
		expect(ensureUserProfile).not.toHaveBeenCalled();
	});
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

	it("redirects to a safe submitted return path after login", async () => {
		arrangeSupabase({ user: stubUser({ id: "user-1" }) });
		vi.mocked(ensureUserProfile).mockResolvedValue({ role: "client" });

		const path = await expectRedirect(
			loginAction(
				initialAuthActionState,
				loginForm({ next: "/find-talent/service-1?tab=details" }),
			),
		);

		expect(path).toBe("/find-talent/service-1?tab=details");
	});

	it("falls back to the role dashboard when the submitted return path is unsafe", async () => {
		arrangeSupabase({ user: stubUser({ id: "user-1" }) });
		vi.mocked(ensureUserProfile).mockResolvedValue({ role: "client" });

		const path = await expectRedirect(
			loginAction(
				initialAuthActionState,
				loginForm({ next: "https://evil.com" }),
			),
		);

		expect(path).toBe("/dashboard/client");
	});

	it("does not redirect on failed login even when next is present", async () => {
		arrangeSupabase({
			signInWithPassword: { error: { message: "Invalid login credentials" } },
		});

		const state = await loginAction(
			initialAuthActionState,
			loginForm({ next: "/jobs/123" }),
		);

		expect(state.formError).toBe("Invalid email or password.");
		expect(recordAuthRateLimitAttempt).toHaveBeenCalledTimes(2);
	});

	it("reports a session that could not be established", async () => {
		arrangeSupabase({ user: null });

		const state = await loginAction(initialAuthActionState, loginForm());

		expect(state.formError).toMatch(/session/i);
		expect(ensureUserProfile).not.toHaveBeenCalled();
	});

	it("does not use a returned user without a session", async () => {
		arrangeSupabase({
			signInWithPassword: {
				data: { user: stubUser({ id: "user-1" }), session: null },
				error: null,
			},
		});

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

	it("accepts registration without optional contact and profile details", async () => {
		arrangeSupabase({
			signUp: { data: { user: { id: "user-1" }, session: null } },
		});

		const state = await registerAction(initialAuthActionState, registerForm({
			phone: "",
			country: "",
			city: "",
			business_type: "",
			project_idea: "",
			interested_solution_types: [],
		}));

		expect(state.formSuccess).toMatch(/confirm your email/i);
	});

	it("blocks a rate-limited signup before creating an account", async () => {
		vi.mocked(recordAuthRateLimitAttempt).mockResolvedValue(BLOCKED);
		const stub = arrangeSupabase();

		const state = await registerAction(initialAuthActionState, registerForm());

		expect(state.formError).toBe(
			"Too many sign-up attempts from your network. Try again in 15 minutes.",
		);
		expect(stub.callKeys()).not.toContain("auth.signUp");
	});

	it("stays generic when the rate limiter itself fails", async () => {
		vi.mocked(recordAuthRateLimitAttempt).mockResolvedValue({
			allowed: false,
			retryAfterSeconds: 0,
		});
		const stub = arrangeSupabase();

		const state = await registerAction(initialAuthActionState, registerForm());

		expect(state.formError).toBe(
			"We could not create your account. Please try again.",
		);
		expect(stub.callKeys()).not.toContain("auth.signUp");
	});

	it("explains when Supabase cannot send more confirmation emails", async () => {
		arrangeSupabase({
			signUp: {
				error: {
					message: "email rate limit exceeded",
					code: "over_email_send_rate_limit",
					status: 429,
				},
			},
		});

		const state = await registerAction(initialAuthActionState, registerForm());

		expect(state.formError).toMatch(/can't send confirmation emails/);
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
		expect(state.verificationRequired).toBe(true);
		expect(state.fields).toEqual({ email: "ana@example.com" });
		expect(ensureUserProfile).not.toHaveBeenCalled();
	});

	it.each([
		["Bosnia & Herzegovina", "Sarajevo, BiH"],
		["USA", "Washington, D.C."],
		["Germany", "Frankfurt (Oder)"],
		["France", "Paris 15"],
		["Côte d’Ivoire", "Abidjan"],
		["Россия", "Санкт-Петербург"],
	])("accepts %s / %s as a location", async (country, city) => {
		const stub = arrangeSupabase({
			signUp: { data: { user: { id: "user-1" }, session: null } },
		});

		const state = await registerAction(
			initialAuthActionState,
			registerForm({ country, city }),
		);

		expect(state.fieldErrors ?? {}).not.toHaveProperty("country");
		expect(state.fieldErrors ?? {}).not.toHaveProperty("city");
		expect(stub.callsFor("auth.signUp")[0]?.payload).toMatchObject({
			options: { data: { country, city } },
		});
	});

	it("rejects markup in a location and names the field", async () => {
		arrangeSupabase();

		const state = await registerAction(
			initialAuthActionState,
			registerForm({ city: "<script>", country: "1234" }),
		);

		expect(state.fieldErrors?.city?.[0]).toMatch(/can only contain letters, numbers/);
		expect(state.fieldErrors).toHaveProperty("country");
		expect(state.formError).toBe("Please fix the highlighted fields: Country, City.");
	});

	it("accepts every solution type and service category at once", async () => {
		const clientStub = arrangeSupabase({
			signUp: { data: { user: { id: "user-1" }, session: null } },
		});

		const clientState = await registerAction(
			initialAuthActionState,
			registerForm({
				interested_solution_types: clientSolutionTypes.filter((type) => type !== "other"),
			}),
		);

		expect(clientState.fieldErrors ?? {}).toEqual({});
		expect(clientStub.callKeys()).toContain("auth.signUp");

		const providerStub = arrangeSupabase({
			signUp: { data: { user: { id: "user-2" }, session: null } },
		});

		const providerState = await registerAction(
			initialAuthActionState,
			registerForm({
				role: "provider",
				provider_type: "freelancer",
				service_categories: providerServiceCategories.filter((category) => category !== "other"),
			}),
		);

		expect(providerState.fieldErrors ?? {}).toEqual({});
		expect(providerStub.callKeys()).toContain("auth.signUp");
	});

	it("accepts provider links pasted without https://", async () => {
		const stub = arrangeSupabase({
			signUp: { data: { user: { id: "user-1" }, session: null } },
		});

		await registerAction(
			initialAuthActionState,
			registerForm({
				role: "provider",
				provider_type: "freelancer",
				service_categories: ["web_development"],
				portfolio_url: "janedoe.dev",
				social_link: "linkedin.com/in/janedoe",
			}),
		);

		expect(stub.callsFor("auth.signUp")[0]?.payload).toMatchObject({
			options: {
				data: {
					portfolio_url: "https://janedoe.dev",
					social_link: "https://linkedin.com/in/janedoe",
				},
			},
		});
	});

	it("still rejects a link that is not a website", async () => {
		arrangeSupabase();

		const state = await registerAction(
			initialAuthActionState,
			registerForm({
				role: "provider",
				provider_type: "freelancer",
				service_categories: ["web_development"],
				portfolio_url: "javascript:alert(1)",
				social_link: "not a link",
			}),
		);

		expect(state.fieldErrors).toHaveProperty("portfolio_url");
		expect(state.fieldErrors).toHaveProperty("social_link");
	});

	it("sends a trusted confirmation callback with a safe return destination", async () => {
		const stub = arrangeSupabase({ signUp: { data: { user: { id: "user-1" }, session: null } } });
		await registerAction(initialAuthActionState, registerForm({ next: "/find-talent/123" }));
		expect(stub.callsFor("auth.signUp")[0]?.payload).toMatchObject({
			options: { emailRedirectTo: "http://localhost:3000/auth/confirm?next=%2Ffind-talent%2F123" },
		});
	});

	it("rejects an unverified signup session before provisioning", async () => {
		const stub = arrangeSupabase({ signUp: { data: { user: { id: "user-1" }, session: { access_token: "token" } } } });
		const state = await registerAction(initialAuthActionState, registerForm());
		expect(state.verificationRequired).toBe(true);
		expect(stub.callKeys()).toContain("auth.signOut");
		expect(ensureUserProfile).not.toHaveBeenCalled();
	});

	it("provisions the profile and lands the user on their dashboard", async () => {
		arrangeSupabase({
			signUp: {
				data: { user: { id: "user-1", email_confirmed_at: "2026-10-01T12:00:00Z" }, session: { access_token: "token" } },
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
				data: { user: { id: "user-1", email_confirmed_at: "2026-10-01T12:00:00Z" }, session: { access_token: "token" } },
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

	it("does not send the submitted values back", async () => {
		arrangeSupabase();

		const invalid = await registerAction(
			initialAuthActionState,
			registerForm({ project_idea: "too short" }),
		);
		arrangeSupabase({ signUp: { error: { message: "User already registered" } } });
		const failed = await registerAction(initialAuthActionState, registerForm());

		expect(invalid.fieldErrors).toHaveProperty("project_idea");
		expect(invalid.fields).toBeUndefined();
		expect(failed.fields).toBeUndefined();
	});
});

describe("registerAction with a profile picture", () => {
	const WEBP = [0x52, 0x49, 0x46, 0x46, 0x10, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];

	function newUser(overrides: Record<string, unknown> = {}) {
		return {
			id: "user-1",
			created_at: new Date().toISOString(),
			identities: [{ id: "identity-1" }],
			...overrides,
		};
	}

	function formWithAvatar(bytes: number[] | Uint8Array) {
		const form = registerForm();
		form.set("avatar", new Blob([new Uint8Array(bytes)], { type: "image/webp" }), "me.webp");
		return form;
	}

	function arrangeAdmin(upload: { error?: { message: string } | null } = {}) {
		const admin = createSupabaseStub({ "storage.avatars.upload": upload });
		vi.mocked(createSupabaseAdminClient).mockReturnValue(admin.client);
		return admin;
	}

	it("stores the picture in the new account's folder", async () => {
		arrangeSupabase({ signUp: { data: { user: newUser(), session: null } } });
		const admin = arrangeAdmin();

		const state = await registerAction(initialAuthActionState, formWithAvatar(WEBP));

		expect(state.formSuccess).toMatch(/confirm your email/i);
		const [path, , options] = admin.callsFor("storage.avatars.upload")[0].payload as [
			string,
			Uint8Array,
			Record<string, unknown>,
		];
		expect(path).toMatch(/^user-1\/[0-9a-f-]{36}\.webp$/);
		expect(options).toMatchObject({ contentType: "image/webp", upsert: false });
	});

	it("rejects an invalid or oversized picture before creating the account", async () => {
		const stub = arrangeSupabase();

		const gif = await registerAction(
			initialAuthActionState,
			formWithAvatar([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]),
		);
		const large = await registerAction(
			initialAuthActionState,
			formWithAvatar(new Uint8Array(48 * 1024 + 1)),
		);

		expect(gif.fieldErrors).toEqual({ avatar: ["Upload a PNG, JPEG or WebP image."] });
		expect(large.fieldErrors).toEqual({ avatar: ["The image must be 48 KB or smaller."] });
		expect(stub.callKeys()).not.toContain("auth.signUp");
		expect(createSupabaseAdminClient).not.toHaveBeenCalled();
	});

	it("does not store a picture for an already registered email", async () => {
		// Supabase returns a user without identities for a confirmed email.
		arrangeSupabase({ signUp: { data: { user: newUser({ identities: [] }), session: null } } });
		arrangeAdmin();

		await registerAction(initialAuthActionState, formWithAvatar(WEBP));

		expect(createSupabaseAdminClient).not.toHaveBeenCalled();
	});

	it("does not store a picture on an existing unconfirmed account", async () => {
		arrangeSupabase({
			signUp: { data: { user: newUser({ created_at: "2026-01-01T00:00:00Z" }), session: null } },
		});
		arrangeAdmin();

		await registerAction(initialAuthActionState, formWithAvatar(WEBP));

		expect(createSupabaseAdminClient).not.toHaveBeenCalled();
	});

	it("still registers the account when storing the picture fails", async () => {
		arrangeSupabase({ signUp: { data: { user: newUser(), session: null } } });
		vi.mocked(createSupabaseAdminClient).mockImplementation(() => {
			throw new Error("missing service role key");
		});
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

		const state = await registerAction(initialAuthActionState, formWithAvatar(WEBP));

		expect(state.formSuccess).toMatch(/confirm your email/i);
		expect(consoleError).toHaveBeenCalled();
	});

	it("ignores an empty file input", async () => {
		arrangeSupabase({ signUp: { data: { user: newUser(), session: null } } });
		const form = registerForm();
		form.set("avatar", new Blob([]), "");

		const state = await registerAction(initialAuthActionState, form);

		expect(state.formSuccess).toMatch(/confirm your email/i);
		expect(createSupabaseAdminClient).not.toHaveBeenCalled();
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
