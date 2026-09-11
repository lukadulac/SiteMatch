import { describe, expect, it } from "vitest";
import { getPublicProviderServiceById } from "@/lib/provider-services/service";
import { createSupabaseStub } from "../helpers/supabase-stub";

const SERVICE_ID = "service-1";

function serviceRow(overrides: Record<string, unknown> = {}) {
	return {
		id: SERVICE_ID,
		provider_id: "provider-1",
		title: "Brand identity package",
		description: "A complete brand identity package for growing teams.",
		status: "published",
		price_type: "fixed",
		starting_price: 1800,
		delivery_bucket: "one_to_two_weeks",
		delivery_estimate: "1-2 weeks",
		published_at: "2026-09-01T10:00:00.000Z",
		created_at: "2026-09-01T09:00:00.000Z",
		updated_at: "2026-09-01T10:00:00.000Z",
		service_type_id: "service-type-1",
		service_type_text: null,
		category_id: "category-1",
		category_text: null,
		provider: {
			id: "provider-1",
			full_name: "Amina Morgan",
			avatar_url: null,
			country: "Portugal",
			city: "Lisbon",
		},
		service_type: {
			id: "service-type-1",
			name: "Brand identity",
			slug: "brand-identity",
		},
		category: {
			id: "category-1",
			name: "Design & Creative",
			slug: "design-creative",
		},
		...overrides,
	};
}

describe("getPublicProviderServiceById", () => {
	it("returns a published provider service detail", async () => {
		const row = serviceRow();
		const stub = createSupabaseStub({
			"provider_service_listings.select": { data: row },
		});

		const result = await getPublicProviderServiceById(stub.client, SERVICE_ID);

		expect(result.data).toEqual(row);
		expect(result.error).toBeUndefined();
	});

	it("only selects the requested published service", async () => {
		const stub = createSupabaseStub({
			"provider_service_listings.select": { data: serviceRow() },
		});

		await getPublicProviderServiceById(stub.client, SERVICE_ID);

		expect(
			stub.callsFor("provider_service_listings.select")[0]?.filters,
		).toEqual([
			{ method: "eq", args: ["id", SERVICE_ID] },
			{ method: "eq", args: ["status", "published"] },
		]);
	});

	it("returns not found when the published service is missing", async () => {
		const stub = createSupabaseStub({
			"provider_service_listings.select": { data: null },
		});

		const result = await getPublicProviderServiceById(stub.client, SERVICE_ID);

		expect(result).toEqual({ error: "Service not found." });
	});

	it("surfaces a database error", async () => {
		const stub = createSupabaseStub({
			"provider_service_listings.select": {
				error: { message: "database unavailable" },
			},
		});

		const result = await getPublicProviderServiceById(stub.client, SERVICE_ID);

		expect(result).toEqual({ error: "database unavailable" });
	});
});
