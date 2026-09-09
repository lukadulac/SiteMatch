import { describe, expect, it } from "vitest";
import { isClientProfileComplete } from "@/lib/auth/profile-completion";

type Profile = Parameters<typeof isClientProfileComplete>[0];

function completeProfile(overrides: Partial<NonNullable<Profile>> = {}) {
	return {
		business_name: "Dulac Studio",
		business_type: "local_service",
		business_type_text: null,
		project_idea: "A booking site for two salon locations.",
		interested_solution_types: ["business_website"],
		interested_solution_other_text: null,
		...overrides,
	} as NonNullable<Profile>;
}

describe("isClientProfileComplete", () => {
	it("accepts a filled-in profile", () => {
		expect(isClientProfileComplete(completeProfile())).toBe(true);
	});

	it("rejects a missing profile", () => {
		expect(isClientProfileComplete(null)).toBe(false);
	});

	it("rejects blank or whitespace-only required fields", () => {
		expect(isClientProfileComplete(completeProfile({ business_name: "" }))).toBe(
			false,
		);
		expect(
			isClientProfileComplete(completeProfile({ business_name: "   " })),
		).toBe(false);
		expect(isClientProfileComplete(completeProfile({ project_idea: null }))).toBe(
			false,
		);
		expect(isClientProfileComplete(completeProfile({ business_type: null }))).toBe(
			false,
		);
	});

	it("rejects an empty solution type list", () => {
		expect(
			isClientProfileComplete(
				completeProfile({ interested_solution_types: [] }),
			),
		).toBe(false);
	});

	it("requires the paired text whenever 'other' is chosen", () => {
		expect(
			isClientProfileComplete(
				completeProfile({ business_type: "other", business_type_text: null }),
			),
		).toBe(false);
		expect(
			isClientProfileComplete(
				completeProfile({
					business_type: "other",
					business_type_text: "Veterinary clinic",
				}),
			),
		).toBe(true);

		expect(
			isClientProfileComplete(
				completeProfile({
					interested_solution_types: ["other"],
					interested_solution_other_text: null,
				}),
			),
		).toBe(false);
		expect(
			isClientProfileComplete(
				completeProfile({
					interested_solution_types: ["other"],
					interested_solution_other_text: "Interactive kiosk",
				}),
			),
		).toBe(true);
	});
});
