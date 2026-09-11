import type { SupabaseClient } from "@supabase/supabase-js";
import {
	FIND_TALENT_DEFAULT_PAGE,
	FIND_TALENT_DEFAULT_PAGE_SIZE,
	type FindTalentQuery,
} from "@/lib/provider-services/find-talent-query";
import {
	providerServiceListingInputSchema,
	type ProviderServiceListingFormFields,
	type ProviderServiceListingIntent,
} from "@/lib/provider-services/schemas";
import type { Database } from "@/types/supabase";

type ProviderServiceResult<T> =
	| { data: T; error?: never }
	| {
			data?: never;
			error: string;
			fieldErrors?: Record<string, string[] | undefined>;
	  };

type ProviderServiceDraft = Pick<
	Database["public"]["Tables"]["provider_service_listings"]["Row"],
	"id" | "status"
>;

export type ProviderServiceListingDetail =
	Database["public"]["Tables"]["provider_service_listings"]["Row"];

export type PublicProviderServiceListing = ProviderServiceListingDetail & {
	provider: Pick<
		Database["public"]["Tables"]["profiles"]["Row"],
		"id" | "full_name" | "avatar_url" | "country" | "city"
	> | null;
	service_type: Pick<
		Database["public"]["Tables"]["service_types"]["Row"],
		"id" | "name" | "slug"
	> | null;
	category: Pick<
		Database["public"]["Tables"]["project_categories"]["Row"],
		"id" | "name" | "slug"
	> | null;
};

export type PublicProviderServicesPage = {
	services: PublicProviderServiceListing[];
	totalCount: number;
	page: number;
	pageSize: number;
	totalPages: number;
};

type PublicProviderServiceFilters = Partial<Omit<FindTalentQuery, "sort">> & {
	sort?: FindTalentQuery["sort"] | "price_high" | "price_low";
};

type ProviderServiceListing = Pick<
	Database["public"]["Tables"]["provider_service_listings"]["Row"],
	"id" | "provider_id" | "status"
>;

const deletableServiceStatuses: Array<ProviderServiceListing["status"]> = [
	"draft",
	"published",
	"paused",
];

async function ensureProviderUser(
	supabase: SupabaseClient<Database>,
	userId: string,
): Promise<ProviderServiceResult<null>> {
	const { data: profile, error } = await supabase
		.from("profiles")
		.select("role")
		.eq("id", userId)
		.maybeSingle();

	if (error) {
		return { error: error.message };
	}

	if (!profile || profile.role !== "provider") {
		return { error: "Only providers can access this resource." };
	}

	return { data: null };
}

function buildPublicProviderServicesPage({
	services,
	totalCount,
	page,
	pageSize,
}: {
	services: PublicProviderServiceListing[];
	totalCount: number;
	page: number;
	pageSize: number;
}): PublicProviderServicesPage {
	return {
		services,
		totalCount,
		page,
		pageSize,
		totalPages: totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize),
	};
}

function emptyPublicProviderServicesResult(
	page: number,
	pageSize: number,
): ProviderServiceResult<PublicProviderServicesPage> {
	return {
		data: buildPublicProviderServicesPage({
			services: [],
			totalCount: 0,
			page,
			pageSize,
		}),
	};
}

async function resolveCategoryIdBySlug(
	supabase: SupabaseClient<Database>,
	slug: string,
) {
	const { data, error } = await supabase
		.from("project_categories")
		.select("id")
		.eq("slug", slug)
		.maybeSingle();

	if (error) {
		return { error: error.message };
	}

	return { data: data?.id ?? null };
}

async function resolveServiceTypeIdBySlug(
	supabase: SupabaseClient<Database>,
	slug: string,
) {
	const { data, error } = await supabase
		.from("service_types")
		.select("id")
		.eq("slug", slug)
		.maybeSingle();

	if (error) {
		return { error: error.message };
	}

	return { data: data?.id ?? null };
}

export async function getPublicPublishedProviderServices(
	supabase: SupabaseClient<Database>,
	filters: PublicProviderServiceFilters = {},
): Promise<ProviderServiceResult<PublicProviderServicesPage>> {
	const page = filters.page ?? FIND_TALENT_DEFAULT_PAGE;
	const pageSize = filters.pageSize ?? FIND_TALENT_DEFAULT_PAGE_SIZE;
	const offset = filters.offset ?? (page - 1) * pageSize;
	let query = supabase
		.from("provider_service_listings")
		.select(
			"id, provider_id, title, description, status, price_type, starting_price, delivery_bucket, delivery_estimate, published_at, created_at, updated_at, service_type_id, service_type_text, category_id, category_text, provider:profiles!provider_service_listings_provider_id_fkey(id, full_name, avatar_url, country, city), service_type:service_types!provider_service_listings_service_type_id_fkey(id, name, slug), category:project_categories!provider_service_listings_category_id_fkey(id, name, slug)",
			{ count: "exact" },
		)
		.eq("status", "published");

	if (filters.categorySlug) {
		const categoryResult = await resolveCategoryIdBySlug(
			supabase,
			filters.categorySlug,
		);

		if (categoryResult.error) {
			return { error: categoryResult.error };
		}

		if (!categoryResult.data) {
			return emptyPublicProviderServicesResult(page, pageSize);
		}

		query = query.eq("category_id", categoryResult.data);
	}

	if (filters.serviceTypeSlug) {
		const serviceTypeResult = await resolveServiceTypeIdBySlug(
			supabase,
			filters.serviceTypeSlug,
		);

		if (serviceTypeResult.error) {
			return { error: serviceTypeResult.error };
		}

		if (!serviceTypeResult.data) {
			return emptyPublicProviderServicesResult(page, pageSize);
		}

		query = query.eq("service_type_id", serviceTypeResult.data);
	}

	const search = filters.q?.trim();

	if (search) {
		query = query.or(
			`title.ilike.%${search}%,description.ilike.%${search}%,service_type_text.ilike.%${search}%,category_text.ilike.%${search}%`,
		);
	}

	if (
		filters.priceType === "fixed" ||
		filters.priceType === "hourly" ||
		filters.priceType === "starting_at" ||
		filters.priceType === "negotiable"
	) {
		query = query.eq("price_type", filters.priceType);
	}

	if (filters.minPrice !== undefined) {
		query = query.gte("starting_price", filters.minPrice);
	}

	if (filters.maxPrice !== undefined) {
		query = query.lte("starting_price", filters.maxPrice);
	}

	if (filters.deliveryBucket) {
		query = query.eq("delivery_bucket", filters.deliveryBucket);
	}

	if (filters.sort === "price_desc" || filters.sort === "price_high") {
		query = query.order("starting_price", {
			ascending: false,
			nullsFirst: false,
		});
	} else if (filters.sort === "price_asc" || filters.sort === "price_low") {
		query = query.order("starting_price", {
			ascending: true,
			nullsFirst: false,
		});
	} else if (filters.sort === "oldest") {
		query = query.order("published_at", { ascending: true });
	} else {
		query = query.order("published_at", {
			ascending: false,
			nullsFirst: false,
		});
	}

	query = query.range(offset, offset + pageSize - 1);

	const { data, error, count } = await query;

	if (error) {
		return { error: error.message };
	}

	return {
		data: buildPublicProviderServicesPage({
			services: (data ?? []) as PublicProviderServiceListing[],
			totalCount: count ?? 0,
			page,
			pageSize,
		}),
	};
}

export async function createProviderServiceListing(
	supabase: SupabaseClient<Database>,
	userId: string,
	input: ProviderServiceListingFormFields,
	intent: ProviderServiceListingIntent,
): Promise<ProviderServiceResult<ProviderServiceDraft>> {
	const providerResult = await ensureProviderUser(supabase, userId);

	if (providerResult.error) {
		return { error: providerResult.error };
	}

	const parsed = providerServiceListingInputSchema.safeParse(input);

	if (!parsed.success) {
		return {
			error: "Please fix the highlighted fields.",
			fieldErrors: parsed.error.flatten().fieldErrors,
		};
	}

	const { data: listing, error: insertError } = await supabase
		.from("provider_service_listings")
		.insert({
			provider_id: userId,
			status: intent,
			title: parsed.data.title,
			description: parsed.data.description,
			service_type_id: parsed.data.service_type_id,
			service_type_text: parsed.data.service_type_text,
			category_id: parsed.data.category_id,
			category_text: parsed.data.category_text,
			price_type: parsed.data.price_type,
			starting_price: parsed.data.starting_price,
			delivery_estimate: parsed.data.delivery_estimate,
			published_at: intent === "published" ? new Date().toISOString() : null,
		})
		.select("id, status")
		.single();

	if (insertError) {
		console.error("Provider service listing insert failed", insertError);
		return { error: "Service listing could not be saved." };
	}

	return {
		data: listing,
	};
}

export async function createProviderServiceDraft(
	supabase: SupabaseClient<Database>,
	userId: string,
	input: ProviderServiceListingFormFields,
) {
	return createProviderServiceListing(supabase, userId, input, "draft");
}

export async function getProviderServiceListingForProvider(
	supabase: SupabaseClient<Database>,
	userId: string,
	listingId: string,
): Promise<ProviderServiceResult<ProviderServiceListingDetail>> {
	const providerResult = await ensureProviderUser(supabase, userId);

	if (providerResult.error) {
		return { error: providerResult.error };
	}

	const { data: listing, error } = await supabase
		.from("provider_service_listings")
		.select("*")
		.eq("id", listingId)
		.maybeSingle();

	if (error) {
		return { error: error.message };
	}

	if (!listing || listing.provider_id !== userId) {
		return { error: "Service listing not found." };
	}

	return { data: listing };
}

export async function updateProviderServiceListing(
	supabase: SupabaseClient<Database>,
	userId: string,
	listingId: string,
	input: ProviderServiceListingFormFields,
	intent: ProviderServiceListingIntent,
): Promise<ProviderServiceResult<ProviderServiceDraft>> {
	const existingResult = await getProviderServiceListingForProvider(
		supabase,
		userId,
		listingId,
	);

	if (existingResult.error) {
		return { error: existingResult.error };
	}

	if (!existingResult.data) {
		return { error: "Service listing not found." };
	}

	const existingListing = existingResult.data;
	const parsed = providerServiceListingInputSchema.safeParse(input);

	if (!parsed.success) {
		return {
			error: "Please fix the highlighted fields.",
			fieldErrors: parsed.error.flatten().fieldErrors,
		};
	}

	const nextStatus = intent === "published" ? "published" : "draft";
	const publishedAt =
		nextStatus === "published" && existingListing.published_at === null
			? new Date().toISOString()
			: existingListing.published_at;

	const { data: listing, error } = await supabase
		.from("provider_service_listings")
		.update({
			status: nextStatus,
			title: parsed.data.title,
			description: parsed.data.description,
			service_type_id: parsed.data.service_type_id,
			service_type_text: parsed.data.service_type_text,
			category_id: parsed.data.category_id,
			category_text: parsed.data.category_text,
			price_type: parsed.data.price_type,
			starting_price: parsed.data.starting_price,
			delivery_estimate: parsed.data.delivery_estimate,
			published_at: publishedAt,
		})
		.eq("id", listingId)
		.eq("provider_id", userId)
		.select("id, status")
		.single();

	if (error) {
		console.error("Provider service listing update failed", error);
		return { error: "Service listing could not be saved." };
	}

	return { data: listing };
}

export async function deleteProviderServiceListing(
	supabase: SupabaseClient<Database>,
	userId: string,
	listingId: string,
): Promise<ProviderServiceResult<{ id: string }>> {
	const providerResult = await ensureProviderUser(supabase, userId);

	if (providerResult.error) {
		return { error: providerResult.error };
	}

	const { data: listing, error } = await supabase
		.from("provider_service_listings")
		.select("id, provider_id, status")
		.eq("id", listingId)
		.maybeSingle();

	if (error) {
		return { error: error.message };
	}

	if (!listing || listing.provider_id !== userId) {
		return { error: "Service listing not found." };
	}

	if (!deletableServiceStatuses.includes(listing.status)) {
		return { error: "This service listing cannot be deleted." };
	}

	const { error: deleteError } = await supabase
		.from("provider_service_listings")
		.delete()
		.eq("id", listing.id)
		.eq("provider_id", userId);

	if (deleteError) {
		console.error("Provider service listing delete failed", deleteError);
		return { error: "Service listing could not be deleted." };
	}

	return { data: { id: listing.id } };
}
