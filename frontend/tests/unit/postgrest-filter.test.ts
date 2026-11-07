import { describe, expect, it } from "vitest";
import { ilikeAnyColumn } from "@/lib/supabase/postgrest-filter";

describe("ilikeAnyColumn", () => {
	it("matches plain text in every column", () => {
		expect(ilikeAnyColumn(["title", "description"], "logo")).toBe('title.ilike."%logo%",description.ilike."%logo%"');
	});

	it("keeps PostgREST syntax characters inside the quoted value", () => {
		expect(ilikeAnyColumn(["title"], "a,b.c(d)")).toBe('title.ilike."%a,b.c(d)%"');
		expect(ilikeAnyColumn(["title"], "x,status.eq.draft")).toBe('title.ilike."%x,status.eq.draft%"');
	});

	it("makes LIKE wildcards and quotes literal", () => {
		expect(ilikeAnyColumn(["title"], '50%_off "now"')).toBe('title.ilike."%50\\\\%\\\\_off \\"now\\"%"');
		expect(ilikeAnyColumn(["title"], "back\\slash")).toBe('title.ilike."%back\\\\\\\\slash%"');
	});
});
