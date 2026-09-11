import z from "zod";
import type { Database } from "@/types/supabase";

export const FIND_TALENT_DEFAULT_PAGE = 1;
export const FIND_TALENT_DEFAULT_PAGE_SIZE = 20;
export const FIND_TALENT_MAX_PAGE_SIZE = 50;

const priceTypeSchema = z.enum([
	"fixed",
	"hourly",
	"starting_at",
	"negotiable",
]);

const deliveryBucketSchema = z.enum([
	"urgent_24h",
	"up_to_3_days",
	"up_to_1_week",
	"up_to_2_weeks",
	"up_to_1_month",
	"flexible",
]);

const sortSchema = z.enum(["newest", "oldest", "price_asc", "price_desc"]);
const slugSchema = z
	.string()
	.max(100)
	.regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Invalid slug format.");

type RawFindTalentQueryValue = string | string[] | undefined;

export type RawFindTalentQuery = {
	q?: RawFindTalentQueryValue;
	category?: RawFindTalentQueryValue;
	serviceType?: RawFindTalentQueryValue;
	priceType?: RawFindTalentQueryValue;
	minPrice?: RawFindTalentQueryValue;
	maxPrice?: RawFindTalentQueryValue;
	delivery?: RawFindTalentQueryValue;
	sort?: RawFindTalentQueryValue;
	page?: RawFindTalentQueryValue;
	pageSize?: RawFindTalentQueryValue;
};

export type FindTalentQuery = {
	q?: string;
	/**
	 * Public URL filters use readable slugs. Resolve these to database IDs in the
	 * service/query layer before filtering by foreign key columns.
	 */
	categorySlug?: string;
	serviceTypeSlug?: string;
	priceType?: Database["public"]["Enums"]["provider_service_price_type"];
	minPrice?: number;
	maxPrice?: number;
	deliveryBucket?: Database["public"]["Enums"]["provider_service_delivery_bucket"];
	sort: z.infer<typeof sortSchema>;
	page: number;
	pageSize: number;
	offset: number;
};

export type FindTalentQueryResult =
	| { data: FindTalentQuery; error?: never; fieldErrors?: never }
	| {
			data?: never;
			error: string;
			fieldErrors: Record<string, string[] | undefined>;
	  };

function firstQueryValue(value: RawFindTalentQueryValue) {
	if (Array.isArray(value)) {
		return value[0] ?? "";
	}

	return value ?? "";
}

function optionalTrimmedString(value: RawFindTalentQueryValue) {
	const trimmed = firstQueryValue(value).trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function optionalNumber(value: RawFindTalentQueryValue) {
	const trimmed = firstQueryValue(value).trim();

	if (!trimmed) {
		return undefined;
	}

	const parsed = Number(trimmed);

	return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function optionalPositiveInteger(
	value: RawFindTalentQueryValue,
	fallback: number,
) {
	const parsed = optionalNumber(value);

	if (parsed === undefined) {
		return fallback;
	}

	return Number.isInteger(parsed) ? parsed : Number.NaN;
}

const normalizedFindTalentQuerySchema = z
	.object({
		q: z.string().max(120).optional(),
		categorySlug: slugSchema.optional(),
		serviceTypeSlug: slugSchema.optional(),
		priceType: priceTypeSchema.optional(),
		minPrice: z.number().min(0).optional(),
		maxPrice: z.number().min(0).optional(),
		deliveryBucket: deliveryBucketSchema.optional(),
		sort: sortSchema.default("newest"),
		page: z.number().int().min(1).default(FIND_TALENT_DEFAULT_PAGE),
		pageSize: z
			.number()
			.int()
			.min(1)
			.max(FIND_TALENT_MAX_PAGE_SIZE)
			.default(FIND_TALENT_DEFAULT_PAGE_SIZE),
	})
	.superRefine((value, ctx) => {
		if (
			value.minPrice !== undefined &&
			value.maxPrice !== undefined &&
			value.minPrice > value.maxPrice
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["maxPrice"],
				message: "Maximum price must be greater than or equal to minimum price.",
			});
		}
	})
	.transform((value) => ({
		...value,
		offset: (value.page - 1) * value.pageSize,
	}));

export function parseFindTalentQuery(
	query: RawFindTalentQuery,
): FindTalentQueryResult {
	const parsed = normalizedFindTalentQuerySchema.safeParse({
		q: optionalTrimmedString(query.q),
		categorySlug: optionalTrimmedString(query.category),
		serviceTypeSlug: optionalTrimmedString(query.serviceType),
		priceType: optionalTrimmedString(query.priceType),
		minPrice: optionalNumber(query.minPrice),
		maxPrice: optionalNumber(query.maxPrice),
		deliveryBucket: optionalTrimmedString(query.delivery),
		sort: optionalTrimmedString(query.sort) ?? "newest",
		page: optionalPositiveInteger(query.page, FIND_TALENT_DEFAULT_PAGE),
		pageSize: optionalPositiveInteger(
			query.pageSize,
			FIND_TALENT_DEFAULT_PAGE_SIZE,
		),
	});

	if (!parsed.success) {
		return {
			error: "Invalid find talent filters.",
			fieldErrors: parsed.error.flatten().fieldErrors,
		};
	}

	return { data: parsed.data };
}

/**
 * Always-valid default FindTalentQuery. Used when a public URL contains invalid
 * filter values and the page should fall back to the default marketplace view.
 */
export function getDefaultFindTalentQuery(): FindTalentQuery {
	const result = parseFindTalentQuery({});

	if (!result.data) {
		throw new Error("Failed to compute default find-talent query.");
	}

	return result.data;
}
