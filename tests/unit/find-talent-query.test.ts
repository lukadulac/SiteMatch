import { describe, expect, it } from "vitest";
import {
	FIND_TALENT_DEFAULT_PAGE,
	FIND_TALENT_DEFAULT_PAGE_SIZE,
	FIND_TALENT_MAX_PAGE_SIZE,
	getDefaultFindTalentQuery,
	parseFindTalentQuery,
} from "@/lib/provider-services/find-talent-query";

describe("parseFindTalentQuery", () => {
	it("returns default pagination and sorting for an empty query", () => {
		const result = parseFindTalentQuery({});

		expect(result.data).toEqual({
			sort: "newest",
			page: FIND_TALENT_DEFAULT_PAGE,
			pageSize: FIND_TALENT_DEFAULT_PAGE_SIZE,
			offset: 0,
		});
	});

	it("normalizes valid filter values from URL strings", () => {
		const result = parseFindTalentQuery({
			q: "  React dashboard  ",
			category: "development",
			serviceType: "web-applications",
			priceType: "starting_at",
			minPrice: "500",
			maxPrice: "2500",
			delivery: "up_to_1_week",
			sort: "price_desc",
			page: "3",
			pageSize: "10",
		});

		expect(result.data).toEqual({
			q: "React dashboard",
			categorySlug: "development",
			serviceTypeSlug: "web-applications",
			priceType: "starting_at",
			minPrice: 500,
			maxPrice: 2500,
			deliveryBucket: "up_to_1_week",
			sort: "price_desc",
			page: 3,
			pageSize: 10,
			offset: 20,
		});
	});

	it("rejects an invalid sort value", () => {
		const result = parseFindTalentQuery({ sort: "random" });

		expect(result.error).toBe("Invalid find talent filters.");
		expect(result.fieldErrors).toHaveProperty("sort");
	});

	it("rejects invalid slug formats", () => {
		for (const category of ["UI-UX", "-design", "design--system"]) {
			const result = parseFindTalentQuery({ category });

			expect(result.error, category).toBe("Invalid find talent filters.");
			expect(result.fieldErrors, category).toHaveProperty("categorySlug");
		}
	});

	it("rejects non-numeric price filters", () => {
		const result = parseFindTalentQuery({ minPrice: "abc" });

		expect(result.error).toBe("Invalid find talent filters.");
		expect(result.fieldErrors).toHaveProperty("minPrice");
	});

	it("rejects a maximum price below the minimum price", () => {
		const result = parseFindTalentQuery({
			minPrice: "2000",
			maxPrice: "1000",
		});

		expect(result.error).toBe("Invalid find talent filters.");
		expect(result.fieldErrors).toHaveProperty("maxPrice");
	});

	it("rejects page sizes above the configured maximum", () => {
		const result = parseFindTalentQuery({
			pageSize: String(FIND_TALENT_MAX_PAGE_SIZE + 1),
		});

		expect(result.error).toBe("Invalid find talent filters.");
		expect(result.fieldErrors).toHaveProperty("pageSize");
	});
});

describe("getDefaultFindTalentQuery", () => {
	it("returns the same defaults as parsing an empty query", () => {
		expect(getDefaultFindTalentQuery()).toEqual(parseFindTalentQuery({}).data);
	});
});
