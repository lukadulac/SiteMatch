import { describe, expect, it } from "vitest";
import type {
	PublicClientProfile,
	PublicProviderProfile,
} from "@/lib/profiles/public-profile";
import {
	formatMoneyRange,
	formatProjectBudget,
	getClientBusinessType,
	getProfileDisplayName,
	getProfileLocation,
	getProviderDisciplines,
	getProviderRates,
	getProviderRoleLine,
	splitTextList,
} from "@/lib/profiles/public-profile-view";
import { getPublicPublishedProjects } from "@/lib/projects/service";
import { getPublicPublishedProviderServices } from "@/lib/provider-services/service";
import { createSupabaseStub } from "../helpers/supabase-stub";

const PROVIDER_ID = "00000000-0000-0000-0000-00000000b001";
const CLIENT_ID = "00000000-0000-0000-0000-00000000c001";

function provider(
	details: Partial<NonNullable<PublicProviderProfile["provider"]>> | null = {},
	overrides: Partial<PublicProviderProfile> = {},
): PublicProviderProfile {
	return {
		id: PROVIDER_ID,
		role: "provider",
		full_name: "Provider One",
		avatar_url: null,
		city: "Lisbon",
		country: "Portugal",
		member_since: "2026-09-01T10:00:00+00:00",
		provider:
			details === null
				? null
				: {
						display_name: null,
						company_name: null,
						provider_type: "freelancer",
						headline: null,
						bio: null,
						about: null,
						service_categories: [],
						service_category_other_text: null,
						years_of_experience: null,
						team_size: null,
						industries_text: null,
						tech_capabilities_text: null,
						availability: "available",
						hourly_rate_min: null,
						hourly_rate_max: null,
						fixed_price_min: null,
						fixed_price_max: null,
						project_budget_min: null,
						project_budget_max: null,
						...details,
					},
		client: null,
		stats: { jobs_won: 0, collaborations_completed: 0 },
		...overrides,
	};
}

function client(
	details: Partial<NonNullable<PublicClientProfile["client"]>> | null = {},
): PublicClientProfile {
	return {
		id: CLIENT_ID,
		role: "client",
		full_name: "Client One",
		avatar_url: null,
		city: null,
		country: null,
		member_since: "2026-09-01T10:00:00+00:00",
		provider: null,
		client:
			details === null
				? null
				: {
						business_name: "Acme",
						business_type: null,
						business_type_text: null,
						business_description: null,
						company_size: null,
						target_market_text: null,
						...details,
					},
		stats: { projects_posted: 0, hires: 0 },
	};
}

describe("public profile display helpers", () => {
	it("prefers a provider's display name over their legal name", () => {
		expect(getProfileDisplayName(provider({ display_name: "Pixel Works" }))).toBe(
			"Pixel Works",
		);
		expect(getProfileDisplayName(provider({ display_name: "  " }))).toBe(
			"Provider One",
		);
		expect(getProfileDisplayName(client())).toBe("Client One");
	});

	it("joins whichever location parts are set", () => {
		expect(getProfileLocation(provider())).toBe("Lisbon, Portugal");
		expect(getProfileLocation(provider({}, { city: null }))).toBe("Portugal");
		expect(getProfileLocation(client())).toBe("");
	});

	it("formats open and closed money ranges", () => {
		expect(formatMoneyRange(20, 40)).toBe("$20 – $40");
		expect(formatMoneyRange(50, 50)).toBe("$50");
		expect(formatMoneyRange(20, null)).toBe("From $20");
		expect(formatMoneyRange(null, 40)).toBe("Up to $40");
		expect(formatMoneyRange(null, null)).toBeNull();
	});

	it("formats project budgets by type", () => {
		expect(formatProjectBudget("negotiable", 100, 200)).toBe("Negotiable");
		expect(formatProjectBudget("fixed", 900, null)).toBe("Fixed: From $900");
		expect(formatProjectBudget("fixed", null, null)).toBe("Fixed budget");
		expect(formatProjectBudget("range", 500, 1500)).toBe("$500 – $1,500");
		expect(formatProjectBudget("range", null, null)).toBe("Budget not set");
	});

	it("splits free-text lists into unique chips", () => {
		expect(splitTextList("React, Next.js; react\nFigma, ")).toEqual([
			"React",
			"Next.js",
			"Figma",
		]);
		expect(splitTextList(null)).toEqual([]);
	});

	it("describes the provider's type and company", () => {
		expect(getProviderRoleLine(provider({ provider_type: "agency", company_name: "Pixel" }))).toBe(
			"Agency · Pixel",
		);
		expect(getProviderRoleLine(provider())).toBe("Freelancer");
		expect(getProviderRoleLine(provider(null))).toBe("Provider");
	});

	it("labels disciplines, using the provider's wording for other", () => {
		expect(
			getProviderDisciplines(
				provider({
					service_categories: ["ui_ux_design", "other"],
					service_category_other_text: "Webflow",
				}),
			),
		).toEqual(["UI/UX design", "Webflow"]);
		expect(getProviderDisciplines(provider(null))).toEqual([]);
	});

	it("lists only the rates the provider set", () => {
		expect(
			getProviderRates(
				provider({ hourly_rate_min: 20, hourly_rate_max: 40, project_budget_min: 1000 }),
			),
		).toEqual([
			{ label: "Hourly rate", value: "$20 – $40/hr" },
			{ label: "Typical project budget", value: "From $1,000" },
		]);
		expect(getProviderRates(provider(null))).toEqual([]);
	});

	it("labels a client's business type, using their wording for other", () => {
		expect(getClientBusinessType(client({ business_type: "saas_tech" }))).toBe(
			"SaaS / tech",
		);
		expect(
			getClientBusinessType(
				client({ business_type: "other", business_type_text: "Vineyard" }),
			),
		).toBe("Vineyard");
		expect(getClientBusinessType(client())).toBeNull();
		expect(getClientBusinessType(client(null))).toBeNull();
	});
});

describe("listings on a public profile", () => {
	it("narrows published services to one provider", async () => {
		const stub = createSupabaseStub({
			"provider_service_listings.select": { data: [], count: 0 },
		});

		await getPublicPublishedProviderServices(stub.client, {
			providerId: PROVIDER_ID,
			page: 1,
			pageSize: 6,
		});

		expect(
			stub.callsFor("provider_service_listings.select")[0]?.filters,
		).toContainEqual({ method: "eq", args: ["provider_id", PROVIDER_ID] });
	});

	it("narrows open projects to one client", async () => {
		const stub = createSupabaseStub({ "projects.select": { data: [] } });

		await getPublicPublishedProjects(stub.client, { clientId: CLIENT_ID });

		const filters = stub.callsFor("projects.select")[0]?.filters;

		expect(filters).toContainEqual({ method: "eq", args: ["client_id", CLIENT_ID] });
		expect(filters).toContainEqual({ method: "eq", args: ["is_hidden", false] });
	});

	it("does not filter by owner when none is given", async () => {
		const stub = createSupabaseStub({ "projects.select": { data: [] } });

		await getPublicPublishedProjects(stub.client);

		expect(
			stub.callsFor("projects.select")[0]?.filters.map((filter) => filter.args[0]),
		).not.toContain("client_id");
	});
});
