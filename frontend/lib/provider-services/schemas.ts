import z from "zod";

const optionalUuid = z.preprocess(
	(value) => (value === "" ? null : value),
	z.uuid().nullable(),
);

const optionalText = z.preprocess(
	(value) => (value === "" ? null : value),
	z
		.string()
		.trim()
		.max(80, "Delivery estimate must be 80 characters or fewer.")
		.nullable(),
);

const optionalCustomText = (label: string) =>
	z.preprocess(
		(value) => (value === "" ? null : value),
		z
			.string()
			.trim()
			.min(2, `${label} must be at least 2 characters long.`)
			.max(80, `${label} must be 80 characters or fewer.`)
			.nullable(),
	);

const optionalPrice = z.preprocess((value) => {
	if (value === "" || value === null || value === undefined) {
		return null;
	}

	return Number(value);
}, z.number().min(0, "Price must be greater than or equal to 0.").nullable());

export const providerServiceListingInputSchema = z
	.object({
		title: z
			.string()
			.trim()
			.min(5, "Title must be at least 5 characters long.")
			.max(120, "Title must be 120 characters or fewer."),
		description: z
			.string()
			.trim()
			.min(40, "Description must be at least 40 characters long.")
			.max(4000, "Description must be 4000 characters or fewer."),
		service_type_id: optionalUuid,
		service_type_text: optionalCustomText("Service type"),
		category_id: optionalUuid,
		category_text: optionalCustomText("Category"),
		price_type: z.enum(["fixed", "hourly", "starting_at", "negotiable"]),
		starting_price: optionalPrice,
		delivery_estimate: optionalText,
	})
	.superRefine((value, ctx) => {
		if (!value.service_type_id && !value.service_type_text) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["service_type_text"],
				message: "Choose a service type or enter your own.",
			});
		}

		if (!value.category_id && !value.category_text) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["category_text"],
				message: "Choose a category or enter your own.",
			});
		}

		if (value.price_type !== "negotiable" && value.starting_price === null) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["starting_price"],
				message: "Price is required unless the price type is negotiable.",
			});
		}
	});

export type ProviderServiceListingInput = z.infer<
	typeof providerServiceListingInputSchema
>;

export type ProviderServiceListingFormFields = {
	title: string;
	description: string;
	service_type_id: string;
	service_type_text: string;
	category_id: string;
	category_text: string;
	price_type: string;
	starting_price: string;
	delivery_estimate: string;
};

export type ProviderServiceListingIntent = "draft" | "published";
