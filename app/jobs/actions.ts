"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createApplicationSchema } from "@/lib/projects/schemas";
import { createProjectApplication } from "@/lib/projects/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";


export type JobApplicationActionState = {
	formError?: string;
	fieldErrors?: JobApplicationsFieldErrors;
	fields?: {
		cover_message?: string;
		proposed_price?: string;
		estimated_delivery_days?: string;
	};
};
export type JobApplicationsFieldErrors = {
	cover_message?: string[];
	proposed_price?: string[];
	estimated_delivery_days?: string[];
};

function getStringValue(formData: FormData, key: string) {
	const value = formData.get(key);
	return typeof value === "string" ? value : "";
}
function getNumberValue(formData: FormData, key: string) {
	const value = getStringValue(formData, key).trim();

	if (value === "") {
		return null;
	}

	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : Number.NaN;
}
function buildFields(formData: FormData): JobApplicationActionState["fields"] {
	return {
		cover_message: getStringValue(formData, "cover_message"),
		proposed_price: getStringValue(formData, "proposed_price"),
		estimated_delivery_days: getStringValue(
			formData,
			"estimated_delivery_days",
		),
	};
}
export async function applyToProjectAction(
	projectId: string,
	_prevState: JobApplicationActionState,
	formData: FormData,
): Promise<JobApplicationActionState> {
	const supabase = await createSupabaseServerClient();

	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return {
			formError: "You must be signed in to apply.",
			fieldErrors: {},
			fields: buildFields(formData),
		};
	}

	const payload = {
		cover_message: getStringValue(formData, "cover_message"),
		proposed_price: getNumberValue(formData, "proposed_price"),
		estimated_delivery_days: getNumberValue(
			formData,
			"estimated_delivery_days",
		),
	};

	const parsed = createApplicationSchema.safeParse(payload);

	if (!parsed.success) {
		return {
			formError: "Please fix the highlighted fields.",
			fieldErrors: parsed.error.flatten().fieldErrors,
			fields: buildFields(formData),
		};
	}

	const result = await createProjectApplication(
		supabase,
		user.id,
		projectId,
		parsed.data,
	);

	if (result.error) {
		return {
			formError: result.error,
			fieldErrors: {},
			fields: buildFields(formData),
		};
	}

	revalidatePath("/jobs");
	revalidatePath(`/jobs/${projectId}`);
	revalidatePath("/dashboard/provider");

	redirect("/dashboard/provider");
}
