"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLoginHref } from "@/lib/auth/return-url";
import { createServiceRequest } from "@/lib/provider-service-requests/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getStringValue(formData: FormData, key: string) {
	const value = formData.get(key);

	return typeof value === "string" ? value : "";
}

export async function requestProviderServiceAction(
	serviceId: string,
	formData: FormData,
) {
	const returnPath = `/find-talent/${serviceId}`;
	const supabase = await createSupabaseServerClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		redirect(getLoginHref(returnPath));
	}

	const result = await createServiceRequest(supabase, user.id, serviceId, {
		message: getStringValue(formData, "message"),
	});

	if (result.error) {
		const fieldMessage = result.fieldErrors?.message?.[0];

		redirect(
			`${returnPath}?requestError=${encodeURIComponent(
				fieldMessage ?? result.error,
			)}`,
		);
	}

	revalidatePath(returnPath);
	revalidatePath("/dashboard/client");
	revalidatePath("/dashboard/provider/services");
	redirect(
		`${returnPath}?requestStatus=${encodeURIComponent("Request sent.")}`,
	);
}
