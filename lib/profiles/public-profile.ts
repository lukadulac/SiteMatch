import type { SupabaseClient } from "@supabase/supabase-js";
import z from "zod";
import { Constants, type Database } from "@/types/supabase";

const enums = Constants.public.Enums;

const nullableText = z.string().nullable();
const nullableNumber = z.number().nullable();
const count = z.number().int().nonnegative();

const sharedFields = {
	id: z.guid(),
	full_name: z.string(),
	avatar_url: nullableText,
	city: nullableText,
	country: nullableText,
	member_since: z.string(),
};

const providerDetailsSchema = z.object({
	display_name: nullableText,
	company_name: nullableText,
	provider_type: z.enum(enums.provider_type),
	headline: nullableText,
	bio: nullableText,
	about: nullableText,
	service_categories: z.array(z.enum(enums.provider_service_category)),
	service_category_other_text: nullableText,
	years_of_experience: nullableNumber,
	team_size: nullableNumber,
	industries_text: nullableText,
	tech_capabilities_text: nullableText,
	availability: z.enum(enums.availability_status),
	hourly_rate_min: nullableNumber,
	hourly_rate_max: nullableNumber,
	fixed_price_min: nullableNumber,
	fixed_price_max: nullableNumber,
	project_budget_min: nullableNumber,
	project_budget_max: nullableNumber,
});

const clientDetailsSchema = z.object({
	business_name: z.string(),
	business_type: nullableText,
	business_type_text: nullableText,
	business_description: nullableText,
	company_size: nullableText,
	target_market_text: nullableText,
});

export const publicProfileSchema = z.discriminatedUnion("role", [
	z.object({
		...sharedFields,
		role: z.literal("provider"),
		provider: providerDetailsSchema.nullable(),
		client: z.null(),
		stats: z.object({ jobs_won: count, collaborations_completed: count }),
	}),
	z.object({
		...sharedFields,
		role: z.literal("client"),
		provider: z.null(),
		client: clientDetailsSchema.nullable(),
		stats: z.object({ projects_posted: count, hires: count }),
	}),
]);

export type PublicProfile = z.infer<typeof publicProfileSchema>;
export type PublicProviderProfile = Extract<PublicProfile, { role: "provider" }>;
export type PublicClientProfile = Extract<PublicProfile, { role: "client" }>;

/** `data: null` means there is no public profile to show: answer 404. */
export type PublicProfileResult = { data: PublicProfile | null } | { error: string };

/**
 * A client's or provider's public profile, readable signed out. Everything comes
 * from get_public_profile(), which leaves out contact details, tax IDs and
 * anything else private, and has nothing for admins or disabled accounts.
 */
export async function getPublicProfile(
	supabase: SupabaseClient<Database>,
	userId: string,
): Promise<PublicProfileResult> {
	// The RPC takes a uuid; anything else in the URL is simply not a profile.
	if (!z.guid().safeParse(userId).success) {
		return { data: null };
	}

	const { data, error } = await supabase.rpc("get_public_profile", {
		target_user_id: userId,
	});

	if (error) {
		return { error: "This profile could not be loaded." };
	}

	if (data === null) {
		return { data: null };
	}

	const parsed = publicProfileSchema.safeParse(data);

	if (!parsed.success) {
		return { error: "This profile could not be loaded." };
	}

	return { data: parsed.data };
}
