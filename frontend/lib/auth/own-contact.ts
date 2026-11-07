import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

export type OwnContactDetails = {
	email: string;
	phone: string | null;
};

export type OwnContactResult = { data: OwnContactDetails } | { error: string };

/**
 * The signed-in user's own email and phone. Other users' contact details are not
 * readable, and neither are the caller's own through the profiles table, so this
 * goes through get_own_contact_details().
 */
export async function getOwnContactDetails(
	supabase: SupabaseClient<Database>,
): Promise<OwnContactResult> {
	const { data, error } = await supabase.rpc("get_own_contact_details");
	const contact = data?.[0];

	if (error || !contact) {
		return { error: "Your contact details could not be loaded." };
	}

	return { data: { email: contact.email, phone: contact.phone } };
}

export type OwnProviderTaxIdResult = { data: string | null } | { error: string };

/**
 * The signed-in provider's own tax ID. No user can read tax_id from
 * provider_profiles, their own included, so this goes through
 * get_own_provider_tax_id().
 */
export async function getOwnProviderTaxId(
	supabase: SupabaseClient<Database>,
): Promise<OwnProviderTaxIdResult> {
	const { data, error } = await supabase.rpc("get_own_provider_tax_id");

	if (error) {
		return { error: "Your tax ID could not be loaded." };
	}

	return { data: data ?? null };
}
