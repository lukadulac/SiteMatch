import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	updateAdminProfileAction,
	updateClientProfileAction,
	updateProviderProfileAction,
	withdrawApplicationAction,
} from "@/app/dashboard/actions";
import { withdrawProjectApplicationForProvider } from "@/lib/projects/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildFormData } from "../helpers/form-data";
import { expectRedirectTo } from "../helpers/redirect";
import {
	createSupabaseStub,
	stubUser,
	type StubResponses,
} from "../helpers/supabase-stub";

vi.mock("next/navigation", () => ({
	redirect: (path: string) => {
		throw new Error(`NEXT_REDIRECT:${path}`);
	},
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
	createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/projects/service", () => ({
	withdrawProjectApplicationForProvider: vi.fn(),
}));

const APPLICATION_ID = "application-1";
const EMPTY_STATE = { fieldErrors: {}, fields: {} };

function signIn(userId: string | null, responses: StubResponses = {}) {
	const stub = createSupabaseStub(responses, {
		user: userId ? stubUser({ id: userId }) : null,
	});

	vi.mocked(createSupabaseServerClient).mockResolvedValue(stub.client);

	return stub;
}

function clientProfileForm(
	overrides: Record<string, string | string[] | undefined> = {},
) {
	return buildFormData({
		full_name: "Ana Petrovic",
		phone: "+381 60 123 4567",
		country: "Serbia",
		city: "Novi Sad",
		business_name: "Dulac Studio",
		business_type: "local_service",
		project_idea: "We want a booking site for our two salon locations.",
		interested_solution_types: ["business_website"],
		...overrides,
	});
}

function providerProfileForm(
	overrides: Record<string, string | string[] | undefined> = {},
) {
	return buildFormData({
		full_name: "Ana Petrovic",
		phone: "+381 60 123 4567",
		country: "Serbia",
		city: "Novi Sad",
		provider_type: "freelancer",
		years_of_experience: "3",
		portfolio_url: "https://portfolio.example.com",
		service_categories: ["web_development"],
		...overrides,
	});
}

const PROFILE_WRITE_STUBS: StubResponses = {
	"profiles.update": {},
	"client_profiles.upsert": {},
	"provider_profiles.upsert": {},
};

beforeEach(() => {
	signIn("user-1", PROFILE_WRITE_STUBS);
});

describe("updateClientProfileAction", () => {
	it("requires a signed-in user", async () => {
		signIn(null);

		const state = await updateClientProfileAction(EMPTY_STATE, clientProfileForm());

		expect(state.formError).toMatch(/signed in/i);
	});

	it("requires contact details that the signup form also demands", async () => {
		const state = await updateClientProfileAction(
			EMPTY_STATE,
			clientProfileForm({ phone: "", country: "", city: "" }),
		);

		expect(state.fieldErrors).toHaveProperty("phone");
		expect(state.fieldErrors).toHaveProperty("country");
		expect(state.fieldErrors).toHaveProperty("city");
	});

	it("rejects a phone number with too few digits", async () => {
		const state = await updateClientProfileAction(
			EMPTY_STATE,
			clientProfileForm({ phone: "12345" }),
		);

		expect(state.fieldErrors).toHaveProperty("phone");
	});

	it("rejects a name with characters a person's name would not contain", async () => {
		const state = await updateClientProfileAction(
			EMPTY_STATE,
			clientProfileForm({ full_name: "Ana <script>" }),
		);

		expect(state.fieldErrors).toHaveProperty("full_name");
	});

	it("accepts diacritics and apostrophes in names and places", async () => {
		const state = await updateClientProfileAction(
			EMPTY_STATE,
			clientProfileForm({ full_name: "Miloš O'Brien-Petrović", city: "Niš" }),
		);

		expect(state.formSuccess).toBeTruthy();
	});

	it("rejects a website that is not an http(s) URL", async () => {
		const state = await updateClientProfileAction(
			EMPTY_STATE,
			clientProfileForm({ website_url: "javascript:alert(1)" }),
		);

		expect(state.fieldErrors).toHaveProperty("website_url");
	});

	it("writes the contact details and the business profile", async () => {
		const stub = signIn("user-1", PROFILE_WRITE_STUBS);

		const state = await updateClientProfileAction(EMPTY_STATE, clientProfileForm());

		expect(state.formSuccess).toBeTruthy();
		expect(stub.callsFor("profiles.update")[0]?.payload).toEqual({
			full_name: "Ana Petrovic",
			phone: "+381 60 123 4567",
			country: "Serbia",
			city: "Novi Sad",
		});
		expect(stub.callsFor("client_profiles.upsert")[0]?.payload).toMatchObject({
			user_id: "user-1",
			business_name: "Dulac Studio",
			interested_solution_types: ["business_website"],
		});
	});

	it("does not write the business profile when the contact update fails", async () => {
		const stub = signIn("user-1", {
			...PROFILE_WRITE_STUBS,
			"profiles.update": { error: { message: "permission denied" } },
		});

		const state = await updateClientProfileAction(EMPTY_STATE, clientProfileForm());

		expect(state.formError).toBe("permission denied");
		expect(stub.callKeys()).not.toContain("client_profiles.upsert");
	});

	it("keeps the submitted values when validation fails", async () => {
		const state = await updateClientProfileAction(
			EMPTY_STATE,
			clientProfileForm({ project_idea: "short" }),
		);

		expect(state.fields?.business_name).toBe("Dulac Studio");
	});
});

describe("updateProviderProfileAction", () => {
	it("requires a signed-in user", async () => {
		signIn(null);

		const state = await updateProviderProfileAction(
			EMPTY_STATE,
			providerProfileForm(),
		);

		expect(state.formError).toMatch(/signed in/i);
	});

	it("applies the provider-type tax id rule", async () => {
		const missing = await updateProviderProfileAction(
			EMPTY_STATE,
			providerProfileForm({ provider_type: "agency" }),
		);

		expect(missing.fieldErrors).toHaveProperty("tax_id");

		const forbidden = await updateProviderProfileAction(
			EMPTY_STATE,
			providerProfileForm({ tax_id: "12345678" }),
		);

		expect(forbidden.fieldErrors).toHaveProperty("tax_id");
	});

	it("writes the contact details and the provider profile", async () => {
		const stub = signIn("user-1", PROFILE_WRITE_STUBS);

		const state = await updateProviderProfileAction(
			EMPTY_STATE,
			providerProfileForm({ service_categories: ["web_development", "seo"] }),
		);

		expect(state.formSuccess).toBeTruthy();
		expect(stub.callsFor("provider_profiles.upsert")[0]?.payload).toMatchObject({
			user_id: "user-1",
			provider_type: "freelancer",
			years_of_experience: 3,
			service_categories: ["web_development", "seo"],
		});
	});

	it("surfaces a failure from the provider profile write", async () => {
		signIn("user-1", {
			...PROFILE_WRITE_STUBS,
			"provider_profiles.upsert": { error: { message: "column missing" } },
		});

		const state = await updateProviderProfileAction(
			EMPTY_STATE,
			providerProfileForm(),
		);

		expect(state.formError).toBe("column missing");
	});
});

describe("updateAdminProfileAction", () => {
	it("updates only the contact details", async () => {
		const stub = signIn("admin-1", PROFILE_WRITE_STUBS);

		const state = await updateAdminProfileAction(
			EMPTY_STATE,
			buildFormData({
				full_name: "Admin User",
				phone: "+381 60 123 4567",
				country: "Serbia",
				city: "Novi Sad",
			}),
		);

		expect(state.formSuccess).toBeTruthy();
		expect(stub.callKeys()).toEqual(["profiles.update"]);
	});

	it("allows an admin to leave the optional contact fields blank", async () => {
		const state = await updateAdminProfileAction(
			EMPTY_STATE,
			buildFormData({ full_name: "Admin User" }),
		);

		expect(state.formSuccess).toBeTruthy();
	});

	it("still validates the name", async () => {
		const state = await updateAdminProfileAction(
			EMPTY_STATE,
			buildFormData({ full_name: "A" }),
		);

		expect(state.fieldErrors).toHaveProperty("full_name");
	});
});

describe("withdrawApplicationAction", () => {
	it("sends an anonymous caller to the login page", async () => {
		signIn(null);

		const { pathname } = await expectRedirectTo(
			withdrawApplicationAction(APPLICATION_ID),
		);

		expect(pathname).toBe("/login");
		expect(withdrawProjectApplicationForProvider).not.toHaveBeenCalled();
	});

	it("confirms the withdrawal", async () => {
		vi.mocked(withdrawProjectApplicationForProvider).mockResolvedValue({
			data: { id: APPLICATION_ID, status: "withdrawn" },
		});

		const { pathname, params } = await expectRedirectTo(
			withdrawApplicationAction(APPLICATION_ID),
		);

		expect(pathname).toBe("/dashboard/provider/applications");
		expect(params.get("applicationStatus")).toBe("Proposal withdrawn.");
	});

	it("reports a refusal on the applications page", async () => {
		vi.mocked(withdrawProjectApplicationForProvider).mockResolvedValue({
			error: "Only providers can access this resource.",
		});

		const { pathname, params } = await expectRedirectTo(
			withdrawApplicationAction(APPLICATION_ID),
		);

		expect(pathname).toBe("/dashboard/provider/applications");
		expect(params.get("applicationError")).toBe(
			"Only providers can access this resource.",
		);
	});
});
