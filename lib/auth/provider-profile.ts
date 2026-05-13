import { z } from "zod";

function normalizeWhitespace(value: string) {
	return value.trim().replace(/\s+/g, " ");
}

function optionalText(max: number) {
	return z
		.string()
		.transform(normalizeWhitespace)
		.transform((value) => (value === "" ? null : value))
		.nullable()
		.optional()
		.refine((value) => value == null || value.length <= max, {
			message: `Must be ${max} characters or fewer.`,
		});
}

const requiredUrl = z
	.string()
	.trim()
	.refine((value) => {
		try {
			const parsed = new URL(value);
			return parsed.protocol === "http:" || parsed.protocol === "https:";
		} catch {
			return false;
		}
	}, "Enter a valid URL.");

const optionalUrl = z
	.string()
	.trim()
	.transform((value) => (value === "" ? null : value))
	.nullable()
	.optional()
	.refine((value) => {
		if (value == null) {
			return true;
		}

		try {
			const parsed = new URL(value);
			return parsed.protocol === "http:" || parsed.protocol === "https:";
		} catch {
			return false;
		}
	}, "Enter a valid URL.");

export const providerTypes = [
	"freelancer",
	"agency",
	"company",
	"studio",
	"other",
] as const;

export const providerExperienceOptions = [
	{ value: "0", label: "Less than a year" },
	{ value: "1", label: "1-3 years" },
	{ value: "3", label: "3-5 years" },
	{ value: "5", label: "5-10 years" },
	{ value: "10", label: "10+ years" },
] as const;

export const providerServiceCategories = [
	"web_development",
	"mobile_development",
	"ui_ux_design",
	"graphic_design",
	"video_editing",
	"seo",
	"marketing",
	"copywriting",
	"branding",
	"ecommerce",
	"automation",
	"other",
] as const;

export const providerTypeLabels: Record<
	(typeof providerTypes)[number],
	string
> = {
	freelancer: "Freelancer",
	agency: "Agency",
	company: "Company",
	studio: "Studio",
	other: "Other",
};

export const providerServiceCategoryLabels: Record<
	(typeof providerServiceCategories)[number],
	string
> = {
	web_development: "Web development",
	mobile_development: "Mobile app development",
	ui_ux_design: "UI/UX design",
	graphic_design: "Graphic design",
	video_editing: "Video editing",
	seo: "SEO",
	marketing: "Marketing",
	copywriting: "Copywriting",
	branding: "Branding",
	ecommerce: "E-commerce",
	automation: "Automation",
	other: "Other",
};

export const providerTypeSchema = z.enum(providerTypes);
export const providerServiceCategorySchema = z.enum(providerServiceCategories);

const pibPattern = /^[0-9]{8,12}$/;

export const providerProfileInputSchema = z
	.object({
		provider_type: providerTypeSchema,
		tax_id: z
			.string()
			.trim()
			.transform((value) => (value === "" ? null : value))
			.nullable()
			.optional()
			.refine((value) => value == null || pibPattern.test(value), {
				message: "PIB must contain 8 to 12 digits.",
			}),
		years_of_experience: z.coerce
			.number()
			.int("Years of experience must be a whole number.")
			.min(0, "Years of experience cannot be negative."),
		portfolio_url: requiredUrl,
		social_link: optionalUrl,
		service_categories: z
			.array(providerServiceCategorySchema)
			.max(8)
			.refine((value) => value.length > 0, {
				message: "Choose at least one service category.",
			}),
		service_category_other_text: optionalText(120),
		about: optionalText(3000),
	})
	.superRefine((value, ctx) => {
		if (
			(value.provider_type === "agency" ||
				value.provider_type === "company" ||
				value.provider_type === "studio") &&
			!value.tax_id
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["tax_id"],
				message: "PIB is required for agencies, companies, and studios.",
			});
		}

		if (
			value.provider_type !== "agency" &&
			value.provider_type !== "company" &&
			value.provider_type !== "studio" &&
			value.tax_id
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["tax_id"],
				message: "PIB is only allowed for agencies, companies, and studios.",
			});
		}

		if (
			value.service_categories.includes("other") &&
			!value.service_category_other_text
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["service_category_other_text"],
				message: "Describe the other service category.",
			});
		}

		if (
			!value.service_categories.includes("other") &&
			value.service_category_other_text
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["service_category_other_text"],
				message: "Extra category text is only allowed when Other is selected.",
			});
		}
	});

export type ProviderProfileInput = z.infer<typeof providerProfileInputSchema>;

export function parseProviderProfileForm(
	formData: FormData,
): ProviderProfileInput {
	return providerProfileInputSchema.parse({
		provider_type: formData.get("provider_type"),
		tax_id: formData.get("tax_id"),
		years_of_experience: formData.get("years_of_experience"),
		portfolio_url: formData.get("portfolio_url"),
		social_link: formData.get("social_link"),
		service_categories: formData.getAll("service_categories"),
		service_category_other_text: formData.get("service_category_other_text"),
		about: formData.get("about"),
	});
}
