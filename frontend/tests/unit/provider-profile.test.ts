import { describe, expect, it } from "vitest";
import {
	parseProviderProfileForm,
	providerProfileInputSchema,
} from "@/lib/auth/provider-profile";
import { buildFormData } from "../helpers/form-data";

function baseProviderProfile(overrides: Record<string, unknown> = {}) {
	return {
		provider_type: "freelancer",
		years_of_experience: 3,
		portfolio_url: "https://portfolio.example.com",
		service_categories: ["web_development"],
		...overrides,
	};
}

function fieldErrors(input: unknown) {
	const parsed = providerProfileInputSchema.safeParse(input);

	if (parsed.success) {
		throw new Error("expected parse to fail");
	}

	return parsed.error.flatten().fieldErrors;
}

describe("providerProfileInputSchema", () => {
	it("accepts a complete freelancer profile", () => {
		expect(
			providerProfileInputSchema.safeParse(baseProviderProfile()).success,
		).toBe(true);
	});

	it("requires at least one service category", () => {
		expect(
			fieldErrors(baseProviderProfile({ service_categories: [] })),
		).toHaveProperty("service_categories");
	});

	describe("optional business identifier", () => {
		it("is not required for agencies, companies, and studios", () => {
			for (const provider_type of ["agency", "company", "studio"]) {
				expect(
					providerProfileInputSchema.safeParse(baseProviderProfile({ provider_type })).success,
				).toBe(true);
			}
		});

		it("accepts a non-Serbian identifier", () => {
			expect(
				providerProfileInputSchema.safeParse(
					baseProviderProfile({ provider_type: "agency", tax_id: "GB123456789" }),
				).success,
			).toBe(true);
		});

		it("rejects an excessively long identifier", () => {
			expect(
				fieldErrors(baseProviderProfile({ tax_id: "x".repeat(61) })),
			).toHaveProperty("tax_id");
		});
	});

	describe("the 'other' service category pairing", () => {
		it("requires extra text when 'other' is selected", () => {
			expect(
				fieldErrors(baseProviderProfile({ service_categories: ["other"] })),
			).toHaveProperty("service_category_other_text");
		});

		it("rejects extra text when 'other' is not selected", () => {
			expect(
				fieldErrors(
					baseProviderProfile({
						service_categories: ["seo"],
						service_category_other_text: "Drone footage",
					}),
				),
			).toHaveProperty("service_category_other_text");
		});
	});

	describe("portfolio and social URLs", () => {
		it("allows a portfolio URL to be completed later", () => {
			expect(providerProfileInputSchema.parse(baseProviderProfile({ portfolio_url: "" })).portfolio_url).toBeNull();
		});

		it("rejects non-http(s) schemes in either URL", () => {
			expect(
				fieldErrors(
					baseProviderProfile({ portfolio_url: "javascript:alert(1)" }),
				),
			).toHaveProperty("portfolio_url");
			expect(
				fieldErrors(baseProviderProfile({ social_link: "ftp://example.com" })),
			).toHaveProperty("social_link");
		});

		it("treats a blank social link as absent", () => {
			const parsed = providerProfileInputSchema.parse(
				baseProviderProfile({ social_link: "  " }),
			);

			expect(parsed.social_link).toBeNull();
		});
	});

	describe("years of experience", () => {
		it("does not turn an empty choice into zero", () => {
			expect(providerProfileInputSchema.parse(baseProviderProfile({ years_of_experience: "" })).years_of_experience).toBeNull();
		});
		it("coerces a numeric string", () => {
			const parsed = providerProfileInputSchema.parse(
				baseProviderProfile({ years_of_experience: "5" }),
			);

			expect(parsed.years_of_experience).toBe(5);
		});

		it("rejects negative, fractional, and non-numeric values", () => {
			for (const years_of_experience of [-1, 2.5, "many"]) {
				expect(
					fieldErrors(baseProviderProfile({ years_of_experience })),
				).toHaveProperty("years_of_experience");
			}
		});
	});
});

describe("parseProviderProfileForm", () => {
	it("reads every selected service category, not just the first", () => {
		const parsed = parseProviderProfileForm(
			buildFormData({
				provider_type: "freelancer",
				years_of_experience: "3",
				portfolio_url: "https://portfolio.example.com",
				service_categories: ["web_development", "seo"],
			}),
		);

		expect(parsed.service_categories).toEqual(["web_development", "seo"]);
	});
});
