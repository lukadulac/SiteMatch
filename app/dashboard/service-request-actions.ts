"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
	acceptServiceRequestForProvider,
	cancelServiceRequestForClient,
	rejectServiceRequestForProvider,
} from "@/lib/provider-service-requests/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function dashboardRedirect(path: string, key: string, message: string) {
	redirect(`${path}?${key}=${encodeURIComponent(message)}`);
}

export async function acceptServiceRequestAction(requestId: string) {
	const supabase = await createSupabaseServerClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/login");
	}

	const result = await acceptServiceRequestForProvider(
		supabase,
		user.id,
		requestId,
	);

	if (result.error) {
		dashboardRedirect("/dashboard/provider/services", "serviceError", result.error);
	}

	revalidatePath("/dashboard/provider/services");
	revalidatePath("/dashboard/client");
	revalidatePath("/dashboard/messages");
	dashboardRedirect(
		"/dashboard/provider/services",
		"serviceStatus",
		"Service request accepted.",
	);
}

export async function rejectServiceRequestAction(requestId: string) {
	const supabase = await createSupabaseServerClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/login");
	}

	const result = await rejectServiceRequestForProvider(
		supabase,
		user.id,
		requestId,
	);

	if (result.error) {
		dashboardRedirect("/dashboard/provider/services", "serviceError", result.error);
	}

	revalidatePath("/dashboard/provider/services");
	revalidatePath("/dashboard/client");
	revalidatePath("/dashboard/messages");
	dashboardRedirect(
		"/dashboard/provider/services",
		"serviceStatus",
		"Service request rejected.",
	);
}

export async function cancelServiceRequestAction(requestId: string) {
	const supabase = await createSupabaseServerClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/login");
	}

	const result = await cancelServiceRequestForClient(
		supabase,
		user.id,
		requestId,
	);

	if (result.error) {
		dashboardRedirect("/dashboard/client", "serviceError", result.error);
	}

	revalidatePath("/dashboard/client");
	revalidatePath("/dashboard/provider/services");
	revalidatePath("/dashboard/messages");
	dashboardRedirect("/dashboard/client", "serviceStatus", "Service request cancelled.");
}
