"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ProviderServiceActionState } from "@/app/dashboard/provider/services/action-state";
import {
	createProviderServiceListing,
	deleteProviderServiceListing,
	updateProviderServiceListing,
} from "@/lib/provider-services/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getStringValue(formData: FormData, key: string) {
	const value = formData.get(key);

	return typeof value === "string" ? value : "";
}

export async function createProviderServiceListingAction(
	_previousState: ProviderServiceActionState,
	formData: FormData,
): Promise<ProviderServiceActionState> {
	const fields = {
		title: getStringValue(formData, "title"),
		description: getStringValue(formData, "description"),
		service_type_id: getStringValue(formData, "service_type_id"),
		service_type_text: getStringValue(formData, "service_type_text"),
		category_id: getStringValue(formData, "category_id"),
		category_text: getStringValue(formData, "category_text"),
		price_type: getStringValue(formData, "price_type"),
		starting_price: getStringValue(formData, "starting_price"),
		delivery_estimate: getStringValue(formData, "delivery_estimate"),
	};
	const requestedIntent = getStringValue(formData, "intent");
	const intent = requestedIntent === "published" ? "published" : "draft";
	const supabase = await createSupabaseServerClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/login");
	}

	const result = await createProviderServiceListing(
		supabase,
		user.id,
		fields,
		intent,
	);

	if (result.error) {
		return {
			formError: result.error,
			formSuccess: undefined,
			fieldErrors: result.fieldErrors ?? {},
			fields,
		};
	}

	redirect("/dashboard/provider/services");
}

export async function updateProviderServiceListingAction(
	listingId: string,
	_previousState: ProviderServiceActionState,
	formData: FormData,
): Promise<ProviderServiceActionState> {
	const fields = {
		title: getStringValue(formData, "title"),
		description: getStringValue(formData, "description"),
		service_type_id: getStringValue(formData, "service_type_id"),
		service_type_text: getStringValue(formData, "service_type_text"),
		category_id: getStringValue(formData, "category_id"),
		category_text: getStringValue(formData, "category_text"),
		price_type: getStringValue(formData, "price_type"),
		starting_price: getStringValue(formData, "starting_price"),
		delivery_estimate: getStringValue(formData, "delivery_estimate"),
	};
	const requestedIntent = getStringValue(formData, "intent");
	const intent = requestedIntent === "published" ? "published" : "draft";
	const supabase = await createSupabaseServerClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/login");
	}

	const result = await updateProviderServiceListing(
		supabase,
		user.id,
		listingId,
		fields,
		intent,
	);

	if (result.error) {
		return {
			formError: result.error,
			formSuccess: undefined,
			fieldErrors: result.fieldErrors ?? {},
			fields,
		};
	}

	revalidatePath("/dashboard/provider/services");
	revalidatePath(`/dashboard/provider/services/${listingId}`);
	redirect("/dashboard/provider/services");
}

export async function deleteProviderServiceListingAction(listingId: string) {
	const supabase = await createSupabaseServerClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/login");
	}

	const result = await deleteProviderServiceListing(supabase, user.id, listingId);

	if (result.error) {
		redirect(
			`/dashboard/provider/services?serviceError=${encodeURIComponent(
				result.error,
			)}`,
		);
	}

	revalidatePath("/dashboard/provider/services");
	redirect("/dashboard/provider/services");
}
