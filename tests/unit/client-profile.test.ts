import { describe, expect, it } from "vitest";
import {
	clientProfileInputSchema,
	parseClientProfileForm,
} from "@/lib/auth/client-profile";
import { buildFormData } from "../helpers/form-data";

function baseClientProfile(overrides: Record<string, unknown> = {}) {
	return {
		business_name: "Dulac Studio",
		business_type: "local_service",
		project_idea:
			"We want a booking site for our two salon locations in Novi Sad.",
		interested_solution_types: ["business_website"],
		...overrides,
	};
}

function fieldErrors(input: unknown) {
	const parsed = clientProfileInputSchema.safeParse(input);

	if (parsed.success) {
		throw new Error("expected parse to fail");
	}

	return parsed.error.flatten().fieldErrors;
}

describe("clientProfileInputSchema", () => {
	it("accepts a complete profile", () => {
		expect(clientProfileInputSchema.safeParse(baseClientProfile()).success).toBe(
			true,
		);
	});

	it("requires a project idea of at least 20 characters", () => {
		expect(
			fieldErrors(baseClientProfile({ project_idea: "A small site" })),
		).toHaveProperty("project_idea");
	});

	it("requires at least one solution type", () => {
		expect(
			fieldErrors(baseClientProfile({ interested_solution_types: [] })),
		).toHaveProperty("interested_solution_types");
	});

	it("rejects unknown business and solution types", () => {
		expect(
			fieldErrors(baseClientProfile({ business_type: "space_travel" })),
		).toHaveProperty("business_type");
		expect(
			fieldErrors(
				baseClientProfile({ interested_solution_types: ["mind_reading"] }),
			),
		).toHaveProperty("interested_solution_types");
	});

	describe("the 'other' business type pairing", () => {
		it("requires custom text when 'other' is selected", () => {
			expect(
				fieldErrors(baseClientProfile({ business_type: "other" })),
			).toHaveProperty("business_type_text");
		});

		it("rejects custom text when 'other' is not selected", () => {
			expect(
				fieldErrors(
					baseClientProfile({
						business_type: "ecommerce",
						business_type_text: "Something else",
					}),
				),
			).toHaveProperty("business_type_text");
		});

		it("accepts the matched pair", () => {
			expect(
				clientProfileInputSchema.safeParse(
					baseClientProfile({
						business_type: "other",
						business_type_text: "Veterinary clinic",
					}),
				).success,
			).toBe(true);
		});
	});

	describe("the 'other' solution type pairing", () => {
		it("requires extra text when 'other' is selected", () => {
			expect(
				fieldErrors(
					baseClientProfile({ interested_solution_types: ["other"] }),
				),
			).toHaveProperty("interested_solution_other_text");
		});

		it("rejects extra text when 'other' is not selected", () => {
			expect(
				fieldErrors(
					baseClientProfile({
						interested_solution_types: ["portfolio"],
						interested_solution_other_text: "Something else",
					}),
				),
			).toHaveProperty("interested_solution_other_text");
		});

		it("accepts the matched pair", () => {
			expect(
				clientProfileInputSchema.safeParse(
					baseClientProfile({
						interested_solution_types: ["portfolio", "other"],
						interested_solution_other_text: "Interactive kiosk",
					}),
				).success,
			).toBe(true);
		});
	});

	describe("tax id (PIB)", () => {
		it("accepts 8 to 12 digits", () => {
			for (const business_tax_id of ["12345678", "123456789012"]) {
				expect(
					clientProfileInputSchema.safeParse(
						baseClientProfile({ business_tax_id }),
					).success,
				).toBe(true);
			}
		});

		it("rejects values that are too short, too long, or non-numeric", () => {
			for (const business_tax_id of ["1234567", "1234567890123", "1234567A"]) {
				expect(
					fieldErrors(baseClientProfile({ business_tax_id })),
				).toHaveProperty("business_tax_id");
			}
		});

		it("treats a blank tax id as absent", () => {
			const parsed = clientProfileInputSchema.parse(
				baseClientProfile({ business_tax_id: "   " }),
			);

			expect(parsed.business_tax_id).toBeNull();
		});
	});

	it("normalizes whitespace in the business name", () => {
		const parsed = clientProfileInputSchema.parse(
			baseClientProfile({ business_name: "  Dulac   Studio  " }),
		);

		expect(parsed.business_name).toBe("Dulac Studio");
	});
});

describe("parseClientProfileForm", () => {
	it("reads every selected solution type, not just the first", () => {
		const parsed = parseClientProfileForm(
			buildFormData({
				business_name: "Dulac Studio",
				business_type: "local_service",
				project_idea:
					"We want a booking site for our two salon locations in Novi Sad.",
				interested_solution_types: ["business_website", "portfolio"],
			}),
		);

		expect(parsed.interested_solution_types).toEqual([
			"business_website",
			"portfolio",
		]);
	});

	it("throws when the form is invalid", () => {
		expect(() =>
			parseClientProfileForm(
				buildFormData({
					business_name: "D",
					business_type: "local_service",
					project_idea: "short",
					interested_solution_types: [],
				}),
			),
		).toThrow();
	});
});
