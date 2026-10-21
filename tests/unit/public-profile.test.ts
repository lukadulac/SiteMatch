import { describe, expect, it } from "vitest";
import { getPublicProfile } from "@/lib/profiles/public-profile";
import { createSupabaseStub } from "../helpers/supabase-stub";

const PROVIDER_ID = "00000000-0000-0000-0000-00000000b001";
const CLIENT_ID = "00000000-0000-0000-0000-00000000c001";

function providerProfile(overrides: Record<string, unknown> = {}) {
	return {
		id: PROVIDER_ID,
		role: "provider",
		full_name: "Provider One",
		avatar_url: `${PROVIDER_ID}/avatar.webp`,
		city: "Lisbon",
		country: "Portugal",
		member_since: "2026-09-01T10:00:00+00:00",
		provider: {
			display_name: null,
			company_name: null,
			provider_type: "freelancer",
			headline: "Web builder",
			bio: null,
			about: "I build sites.",
			service_categories: ["web_development"],
			service_category_other_text: null,
			years_of_experience: 4,
			team_size: null,
			industries_text: null,
			tech_capabilities_text: null,
			availability: "busy",
			hourly_rate_min: 20,
			hourly_rate_max: 40,
			fixed_price_min: null,
			fixed_price_max: null,
			project_budget_min: null,
			project_budget_max: null,
		},
		client: null,
		stats: { jobs_won: 2, collaborations_completed: 1 },
		...overrides,
	};
}

function clientProfile(overrides: Record<string, unknown> = {}) {
	return {
		id: CLIENT_ID,
		role: "client",
		full_name: "Client One",
		avatar_url: null,
		city: "Belgrade",
		country: "Serbia",
		member_since: "2026-09-01T10:00:00+00:00",
		provider: null,
		client: {
			business_name: "Client One Ltd",
			business_type: "retail",
			business_type_text: null,
			business_description: null,
			company_size: "2-10",
			target_market_text: null,
		},
		stats: { projects_posted: 3, hires: 2 },
		...overrides,
	};
}

describe("getPublicProfile", () => {
	it("returns a provider's public profile from the RPC", async () => {
		const supabase = createSupabaseStub({ "rpc.get_public_profile": { data: providerProfile() } });

		const result = await getPublicProfile(supabase.client, PROVIDER_ID);

		expect(result).toEqual({ data: providerProfile() });
		expect(supabase.callsFor("rpc.get_public_profile")[0]?.payload).toEqual({
			target_user_id: PROVIDER_ID,
		});
	});

	it("returns a client's public profile from the RPC", async () => {
		const supabase = createSupabaseStub({ "rpc.get_public_profile": { data: clientProfile() } });

		const result = await getPublicProfile(supabase.client, CLIENT_ID);

		expect(result).toEqual({ data: clientProfile() });
	});

	it("keeps a provider who never filled in the provider profile", async () => {
		const supabase = createSupabaseStub({
			"rpc.get_public_profile": { data: providerProfile({ provider: null }) },
		});

		const result = await getPublicProfile(supabase.client, PROVIDER_ID);

		expect(result).toEqual({ data: providerProfile({ provider: null }) });
	});

	it("returns no profile when the RPC has none", async () => {
		const supabase = createSupabaseStub({ "rpc.get_public_profile": { data: null } });

		const result = await getPublicProfile(supabase.client, PROVIDER_ID);

		expect(result).toEqual({ data: null });
	});

	it("returns no profile for an id that is not a uuid, without asking the database", async () => {
		const supabase = createSupabaseStub();

		const result = await getPublicProfile(supabase.client, "not-a-uuid");

		expect(result).toEqual({ data: null });
		expect(supabase.calls).toEqual([]);
	});

	it("drops any field the page is not meant to show", async () => {
		const supabase = createSupabaseStub({
			"rpc.get_public_profile": {
				data: providerProfile({
					email: "provider@example.test",
					provider: { ...providerProfile().provider, tax_id: "87654321", is_verified: true },
				}),
			},
		});

		const result = await getPublicProfile(supabase.client, PROVIDER_ID);

		expect(result).toEqual({ data: providerProfile() });
	});

	it("returns a user-facing error instead of the database error", async () => {
		const supabase = createSupabaseStub({
			"rpc.get_public_profile": { error: { message: "function get_public_profile does not exist" } },
		});

		const result = await getPublicProfile(supabase.client, PROVIDER_ID);

		expect(result).toEqual({ error: "This profile could not be loaded." });
	});

	it("returns the same error when the RPC answers in an unexpected shape", async () => {
		const supabase = createSupabaseStub({
			"rpc.get_public_profile": { data: providerProfile({ stats: { jobs_won: "two" } }) },
		});

		const result = await getPublicProfile(supabase.client, PROVIDER_ID);

		expect(result).toEqual({ error: "This profile could not be loaded." });
	});
});
