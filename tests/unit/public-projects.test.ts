import { describe, expect, it } from "vitest";
import {
	getPublicPublishedProjectById,
	getPublicPublishedProjects,
	getPublishedProjectByIdForProvider,
	getPublishedProjectsForProviders,
} from "@/lib/projects/service";
import { createSupabaseStub } from "../helpers/supabase-stub";

const PROVIDER_ID = "provider-1";
const PROJECT_ID = "project-1";

function listing(overrides: Record<string, unknown> = {}) {
	return {
		id: PROJECT_ID,
		slug: "landing-page",
		title: "Landing page",
		description: "A marketing site for a salon.",
		what_do_you_need_text: "A five page site.",
		status: "published",
		budget_type: "range",
		budget_min: 500,
		budget_max: 1500,
		scope_level: "small",
		readiness_level: null,
		preferred_language: null,
		preferred_provider_type: "any",
		...overrides,
	};
}

describe("getPublicPublishedProjects filtering", () => {
	it("returns every open listing when no filters are given", async () => {
		const stub = createSupabaseStub({
			"projects.select": {
				data: [listing(), listing({ id: "project-2", status: "in_discussion" })],
			},
		});

		const result = await getPublicPublishedProjects(stub.client);

		expect(result.data).toHaveLength(2);
	});

	it("returns an empty list rather than null", async () => {
		const stub = createSupabaseStub({ "projects.select": { data: null } });

		expect(await getPublicPublishedProjects(stub.client)).toEqual({ data: [] });
	});

	it("filters by budget type", async () => {
		const stub = createSupabaseStub({
			"projects.select": {
				data: [
					listing({ id: "fixed-1", budget_type: "fixed" }),
					listing({ id: "range-1", budget_type: "range" }),
				],
			},
		});

		const result = await getPublicPublishedProjects(stub.client, {
			budget: "fixed",
		});

		expect(result.data?.map((project) => project.id)).toEqual(["fixed-1"]);
	});

	it("filters by scope level", async () => {
		const stub = createSupabaseStub({
			"projects.select": {
				data: [
					listing({ id: "small-1", scope_level: "small" }),
					listing({ id: "large-1", scope_level: "large" }),
				],
			},
		});

		const result = await getPublicPublishedProjects(stub.client, {
			scope: "large",
		});

		expect(result.data?.map((project) => project.id)).toEqual(["large-1"]);
	});

	it("treats an empty filter value as no filter", async () => {
		const stub = createSupabaseStub({
			"projects.select": {
				data: [listing({ budget_type: "fixed" }), listing({ id: "project-2" })],
			},
		});

		const result = await getPublicPublishedProjects(stub.client, {
			budget: "",
			scope: "",
			q: "   ",
		});

		expect(result.data).toHaveLength(2);
	});

	describe("free-text search", () => {
		it("matches case-insensitively across the searchable text fields", async () => {
			const rows = [
				listing({ id: "by-title", title: "Shopify migration" }),
				listing({ id: "by-description", description: "Needs a Shopify theme" }),
				listing({ id: "by-need", what_do_you_need_text: "shopify setup" }),
				listing({ id: "unrelated", title: "Logo work", description: "Brand kit", what_do_you_need_text: "A logo" }),
			];
			const stub = createSupabaseStub({ "projects.select": { data: rows } });

			const result = await getPublicPublishedProjects(stub.client, {
				q: "SHOPIFY",
			});

			expect(result.data?.map((project) => project.id)).toEqual([
				"by-title",
				"by-description",
				"by-need",
			]);
		});

		it("matches on language, provider type, scope, and readiness", async () => {
			const stub = createSupabaseStub({
				"projects.select": {
					data: [
						listing({ id: "language", preferred_language: "Serbian" }),
						listing({ id: "unrelated" }),
					],
				},
			});

			const result = await getPublicPublishedProjects(stub.client, {
				q: "serbian",
			});

			expect(result.data?.map((project) => project.id)).toEqual(["language"]);
		});

		it("ignores null text fields instead of throwing", async () => {
			const stub = createSupabaseStub({
				"projects.select": {
					data: [
						listing({
							preferred_language: null,
							scope_level: null,
							readiness_level: null,
						}),
					],
				},
			});

			const result = await getPublicPublishedProjects(stub.client, {
				q: "anything",
			});

			expect(result.data).toEqual([]);
		});
	});

	describe("sorting", () => {
		it("asks the database for ascending order only when sorting oldest first", async () => {
			const oldestStub = createSupabaseStub({
				"projects.select": { data: [listing()] },
			});
			await getPublicPublishedProjects(oldestStub.client, { sort: "oldest" });

			const newestStub = createSupabaseStub({
				"projects.select": { data: [listing()] },
			});
			await getPublicPublishedProjects(newestStub.client, { sort: "newest" });

			const orderArgs = (stub: typeof oldestStub) =>
				stub
					.callsFor("projects.select")[0]
					?.filters.find((filter) => filter.method === "order")?.args[1];

			expect(orderArgs(oldestStub)).toEqual({ ascending: true });
			expect(orderArgs(newestStub)).toEqual({ ascending: false });
		});

		it("sorts by the highest budget, preferring the maximum", async () => {
			const stub = createSupabaseStub({
				"projects.select": {
					data: [
						listing({ id: "mid", budget_min: 500, budget_max: 1500 }),
						listing({ id: "high", budget_min: 100, budget_max: 9000 }),
						listing({ id: "low", budget_min: 200, budget_max: 300 }),
					],
				},
			});

			const result = await getPublicPublishedProjects(stub.client, {
				sort: "budget_high",
			});

			expect(result.data?.map((project) => project.id)).toEqual([
				"high",
				"mid",
				"low",
			]);
		});

		it("falls back to the minimum when no maximum is set", async () => {
			const stub = createSupabaseStub({
				"projects.select": {
					data: [
						listing({ id: "min-only", budget_min: 5000, budget_max: null }),
						listing({ id: "max-set", budget_min: 100, budget_max: 900 }),
					],
				},
			});

			const result = await getPublicPublishedProjects(stub.client, {
				sort: "budget_high",
			});

			expect(result.data?.map((project) => project.id)).toEqual([
				"min-only",
				"max-set",
			]);
		});

		it("pushes budget-less listings to the end when sorting by highest budget", async () => {
			const stub = createSupabaseStub({
				"projects.select": {
					data: [
						listing({ id: "no-budget", budget_min: null, budget_max: null }),
						listing({ id: "has-budget", budget_min: 100, budget_max: 900 }),
					],
				},
			});

			const result = await getPublicPublishedProjects(stub.client, {
				sort: "budget_high",
			});

			expect(result.data?.map((project) => project.id)).toEqual([
				"has-budget",
				"no-budget",
			]);
		});

		it("sorts by the lowest budget in the opposite direction", async () => {
			const stub = createSupabaseStub({
				"projects.select": {
					data: [
						listing({ id: "high", budget_max: 9000 }),
						listing({ id: "low", budget_max: 300 }),
					],
				},
			});

			const result = await getPublicPublishedProjects(stub.client, {
				sort: "budget_low",
			});

			expect(result.data?.map((project) => project.id)).toEqual(["low", "high"]);
		});
	});

	it("surfaces a database error", async () => {
		const stub = createSupabaseStub({
			"projects.select": { error: { message: "connection lost" } },
		});

		expect((await getPublicPublishedProjects(stub.client)).error).toBe(
			"connection lost",
		);
	});
});

describe("getPublicPublishedProjectById", () => {
	it("reports a missing listing", async () => {
		const stub = createSupabaseStub({ "projects.select": { data: null } });

		expect(
			(await getPublicPublishedProjectById(stub.client, PROJECT_ID)).error,
		).toBe("Project not found.");
	});

	it("attaches the selected goal and feature ids", async () => {
		const stub = createSupabaseStub({
			"projects.select": { data: listing() },
			"project_request_goals.select": { data: [{ goal_id: "goal-1" }] },
			"project_request_features.select": { data: [{ feature_id: "feature-1" }] },
		});

		const result = await getPublicPublishedProjectById(stub.client, PROJECT_ID);

		expect(result.data?.goal_ids).toEqual(["goal-1"]);
		expect(result.data?.feature_ids).toEqual(["feature-1"]);
	});
});

describe("provider-scoped wrappers", () => {
	it("refuses the listing feed to a non-provider", async () => {
		const stub = createSupabaseStub({
			"profiles.select": { data: { role: "client" } },
		});

		const result = await getPublishedProjectsForProviders(stub.client, "client-1");

		expect(result.error).toBe("Only providers can access this resource.");
		expect(stub.callKeys()).not.toContain("projects.select");
	});

	it("refuses a single listing to a non-provider", async () => {
		const stub = createSupabaseStub({
			"profiles.select": { data: { role: "client" } },
		});

		const result = await getPublishedProjectByIdForProvider(
			stub.client,
			"client-1",
			PROJECT_ID,
		);

		expect(result.error).toBe("Only providers can access this resource.");
		expect(stub.callKeys()).not.toContain("projects.select");
	});

	it("serves the feed to a provider", async () => {
		const stub = createSupabaseStub({
			"profiles.select": { data: { role: "provider" } },
			"projects.select": { data: [listing()] },
		});

		const result = await getPublishedProjectsForProviders(stub.client, PROVIDER_ID);

		expect(result.data).toHaveLength(1);
	});
});
