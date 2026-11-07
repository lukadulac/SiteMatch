import { describe, expect, it } from "vitest";
import {
	createApplicationSchema,
	createProjectSchema,
	updateApplicationStatusSchema,
} from "@/lib/projects/schemas";

const UUID = "11111111-1111-4111-8111-111111111111";
const OTHER_UUID = "22222222-2222-4222-8222-222222222222";

function baseProject(overrides: Record<string, unknown> = {}) {
	return {
		title: "Landing page redesign",
		description: "A".repeat(60),
		service_type_id: UUID,
		business_domain_id: UUID,
		what_do_you_need_text: "We need a brand new marketing site.",
		budget_type: "range",
		budget_min: 500,
		budget_max: 1500,
		deadline_type: "flexible",
		...overrides,
	};
}

function fieldErrors(input: unknown) {
	const parsed = createProjectSchema.safeParse(input);

	if (parsed.success) {
		throw new Error("expected parse to fail");
	}

	return parsed.error.flatten().fieldErrors;
}

describe("createProjectSchema", () => {
	it("accepts a minimal valid listing", () => {
		expect(createProjectSchema.safeParse(baseProject()).success).toBe(true);
	});

	it("applies defaults for omitted optional fields", () => {
		const parsed = createProjectSchema.parse({
			title: "Landing page redesign",
			description: "A".repeat(60),
			service_type_id: UUID,
			business_domain_id: UUID,
			what_do_you_need_text: "We need a brand new marketing site.",
			budget_min: 500,
		});

		expect(parsed.budget_type).toBe("range");
		expect(parsed.deadline_type).toBe("flexible");
		expect(parsed.preferred_provider_type).toBe("any");
		expect(parsed.status).toBe("draft");
		expect(parsed.is_remote_friendly).toBe(true);
		expect(parsed.has_existing_website).toBe(false);
		expect(parsed.goal_ids).toEqual([]);
		expect(parsed.feature_ids).toEqual([]);
	});

	it("normalizes whitespace in text fields", () => {
		const parsed = createProjectSchema.parse(
			baseProject({
				title: "   Landing    page   redesign   ",
				business_context_text: "  spaced    out  ",
			}),
		);

		expect(parsed.title).toBe("Landing page redesign");
		expect(parsed.business_context_text).toBe("spaced out");
	});

	it("turns blank optional text into null", () => {
		const parsed = createProjectSchema.parse(
			baseProject({ business_context_text: "   ", discovery_notes: "" }),
		);

		expect(parsed.business_context_text).toBeNull();
		expect(parsed.discovery_notes).toBeNull();
	});

	it("requires a business domain id or custom domain text", () => {
		expect(
			fieldErrors(
				baseProject({
					business_domain_id: null,
					business_domain_other_text: null,
				}),
			),
		).toHaveProperty("business_domain_other_text");

		expect(
			createProjectSchema.safeParse(
				baseProject({
					business_domain_id: null,
					business_domain_other_text: "Veterinary clinics",
				}),
			).success,
		).toBe(true);
	});

	describe("budget rules", () => {
		it("rejects a minimum above the maximum", () => {
			expect(
				fieldErrors(baseProject({ budget_min: 2000, budget_max: 1000 })),
			).toHaveProperty("budget_max");
		});

		it("accepts an equal minimum and maximum", () => {
			expect(
				createProjectSchema.safeParse(
					baseProject({ budget_min: 1000, budget_max: 1000 }),
				).success,
			).toBe(true);
		});

		it("requires at least one budget value unless negotiable", () => {
			expect(
				fieldErrors(baseProject({ budget_min: null, budget_max: null })),
			).toHaveProperty("budget_min");
		});

		it("allows both budget values to be empty when negotiable", () => {
			expect(
				createProjectSchema.safeParse(
					baseProject({
						budget_type: "negotiable",
						budget_min: null,
						budget_max: null,
					}),
				).success,
			).toBe(true);
		});

		it("rejects a negative budget", () => {
			expect(fieldErrors(baseProject({ budget_min: -1 }))).toHaveProperty(
				"budget_min",
			);
		});
	});

	describe("deadline rules", () => {
		it("requires a date when the deadline type is a specific date", () => {
			expect(
				fieldErrors(
					baseProject({ deadline_type: "specific_date", deadline_date: null }),
				),
			).toHaveProperty("deadline_date");
		});

		it("accepts a specific date when supplied", () => {
			expect(
				createProjectSchema.safeParse(
					baseProject({
						deadline_type: "specific_date",
						deadline_date: "2026-12-01",
					}),
				).success,
			).toBe(true);
		});

		it("rejects a malformed date", () => {
			expect(
				fieldErrors(baseProject({ deadline_date: "01/12/2026" })),
			).toHaveProperty("deadline_date");
		});
	});

	describe("existing website rules", () => {
		it("requires a URL when the client says a site already exists", () => {
			expect(
				fieldErrors(
					baseProject({
						has_existing_website: true,
						existing_website_url: null,
					}),
				),
			).toHaveProperty("existing_website_url");
		});

		it("rejects non-http(s) URL schemes", () => {
			expect(
				fieldErrors(
					baseProject({
						has_existing_website: true,
						existing_website_url: "javascript:alert(1)",
					}),
				),
			).toHaveProperty("existing_website_url");
		});

		it("accepts an https URL", () => {
			expect(
				createProjectSchema.safeParse(
					baseProject({
						has_existing_website: true,
						existing_website_url: "https://example.com",
					}),
				).success,
			).toBe(true);
		});
	});

	it("rejects a title and description under the minimum length", () => {
		const errors = fieldErrors(
			baseProject({ title: "Hi", description: "Too short" }),
		);

		expect(errors).toHaveProperty("title");
		expect(errors).toHaveProperty("description");
	});

	it("rejects non-uuid relation ids", () => {
		expect(
			fieldErrors(baseProject({ service_type_id: "not-a-uuid" })),
		).toHaveProperty("service_type_id");
		expect(fieldErrors(baseProject({ goal_ids: ["not-a-uuid"] }))).toHaveProperty(
			"goal_ids",
		);
	});

	it("caps the number of selected goals and features", () => {
		const tooMany = Array.from({ length: 11 }, () => OTHER_UUID);

		expect(fieldErrors(baseProject({ goal_ids: tooMany }))).toHaveProperty(
			"goal_ids",
		);
		expect(fieldErrors(baseProject({ feature_ids: tooMany }))).toHaveProperty(
			"feature_ids",
		);
	});

	it("rejects statuses a client cannot set directly", () => {
		expect(fieldErrors(baseProject({ status: "in_discussion" }))).toHaveProperty(
			"status",
		);
	});
});

describe("createApplicationSchema", () => {
	it("accepts a proposal with only a cover message", () => {
		expect(
			createApplicationSchema.safeParse({
				cover_message: "I would love to build this for you.",
			}).success,
		).toBe(true);
	});

	it("rejects a cover message under the minimum length", () => {
		expect(createApplicationSchema.safeParse({ cover_message: "Hi" }).success).toBe(
			false,
		);
	});

	it("rejects a non-positive, fractional, or oversized delivery estimate", () => {
		for (const estimated_delivery_days of [0, -5, 2.5, 400]) {
			const parsed = createApplicationSchema.safeParse({
				cover_message: "I would love to build this for you.",
				estimated_delivery_days,
			});

			expect(parsed.success).toBe(false);
		}
	});

	it("rejects a negative or non-numeric proposed price", () => {
		for (const proposed_price of [-1, Number.NaN]) {
			const parsed = createApplicationSchema.safeParse({
				cover_message: "I would love to build this for you.",
				proposed_price,
			});

			expect(parsed.success).toBe(false);
		}
	});
});

describe("updateApplicationStatusSchema", () => {
	it("allows only the statuses a client may set", () => {
		for (const status of ["shortlisted", "accepted", "rejected"]) {
			expect(updateApplicationStatusSchema.safeParse({ status }).success).toBe(
				true,
			);
		}
	});

	it("rejects statuses owned by the system or the provider", () => {
		for (const status of ["pending", "viewed", "withdrawn", "anything"]) {
			expect(updateApplicationStatusSchema.safeParse({ status }).success).toBe(
				false,
			);
		}
	});
});
