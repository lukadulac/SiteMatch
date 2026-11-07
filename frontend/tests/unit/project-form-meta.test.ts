import { describe, expect, it } from "vitest";
import { getProjectFormMeta } from "@/lib/projects/queries";
import { createSupabaseStub } from "../helpers/supabase-stub";

const LOOKUP_TABLES = [
	"service_types",
	"business_domains",
	"project_goals",
	"feature_tags",
] as const;

function lookupStubs(rows: Record<string, unknown[]> = {}) {
	return Object.fromEntries(
		LOOKUP_TABLES.map((table) => [
			`${table}.select`,
			{ data: rows[table] ?? [{ id: `${table}-1`, name: table }] },
		]),
	);
}

describe("getProjectFormMeta", () => {
	it("returns every lookup list the listing form needs", async () => {
		const stub = createSupabaseStub(lookupStubs());

		const result = await getProjectFormMeta(stub.client);

		expect(result.data?.serviceTypes).toHaveLength(1);
		expect(result.data?.businessDomains).toHaveLength(1);
		expect(result.data?.projectGoals).toHaveLength(1);
		expect(result.data?.featureTags).toHaveLength(1);
	});

	it("requests only active rows from each lookup table", async () => {
		const stub = createSupabaseStub(lookupStubs());

		await getProjectFormMeta(stub.client);

		for (const table of LOOKUP_TABLES) {
			expect(stub.callsFor(`${table}.select`)[0]?.filters).toEqual(
				expect.arrayContaining([{ method: "eq", args: ["is_active", true] }]),
			);
		}
	});

	it("substitutes an empty list for a lookup table with no rows", async () => {
		const stub = createSupabaseStub({
			...lookupStubs(),
			"feature_tags.select": { data: null },
		});

		const result = await getProjectFormMeta(stub.client);

		expect(result.data?.featureTags).toEqual([]);
	});

	it("reports the first lookup failure", async () => {
		const stub = createSupabaseStub({
			...lookupStubs(),
			"project_goals.select": { error: { message: "relation missing" } },
		});

		const result = await getProjectFormMeta(stub.client);

		expect(result.error).toBe("relation missing");
		expect(result.data).toBeUndefined();
	});
});
