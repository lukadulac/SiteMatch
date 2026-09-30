"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { completeWorkroomForProvider } from "@/lib/service-workrooms/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type WorkroomActionContext =
	| "provider-home"
	| "provider-services"
	| "provider-workrooms"
	| "provider-workroom-detail";

const uuidPattern =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function formString(formData: FormData | undefined, key: string) {
	const value = formData?.get(key);

	return typeof value === "string" ? value : "";
}

function isUuid(value: string) {
	return uuidPattern.test(value);
}

function parsePage(value: string) {
	const parsed = Number(value);

	return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function parseStatus(value: string) {
	if (value === "active" || value === "completed") {
		return value;
	}

	return "all";
}

function parseContext(value: string): WorkroomActionContext {
	if (
		value === "provider-home" ||
		value === "provider-services" ||
		value === "provider-workrooms" ||
		value === "provider-workroom-detail"
	) {
		return value;
	}

	return "provider-workrooms";
}

function buildListPath(formData: FormData | undefined) {
	const status = parseStatus(formString(formData, "status"));
	const page = parsePage(formString(formData, "page"));
	const params = new URLSearchParams();

	if (status !== "all") {
		params.set("status", status);
	}

	if (page > 1) {
		params.set("page", String(page));
	}

	const query = params.toString();

	return query ? `/dashboard/provider/workrooms?${query}` : "/dashboard/provider/workrooms";
}

function buildRedirectPath({
	context,
	workroomId,
	formData,
}: {
	context: WorkroomActionContext;
	workroomId: string;
	formData: FormData | undefined;
}) {
	switch (context) {
		case "provider-home":
			return "/dashboard/provider";
		case "provider-services":
			return "/dashboard/provider/services";
		case "provider-workroom-detail":
			return `/dashboard/workrooms/${workroomId}`;
		default:
			return buildListPath(formData);
	}
}

function appendNotice(path: string, key: string, message: string) {
	const [pathname, query = ""] = path.split("?");
	const params = new URLSearchParams(query);

	params.set(key, message);

	return `${pathname}?${params.toString()}`;
}

function redirectWithNotice(path: string, key: string, message: string) {
	redirect(appendNotice(path, key, message));
}

function revalidateWorkroomPaths(workroomId: string) {
	revalidatePath("/dashboard/client");
	revalidatePath("/dashboard/provider");
	revalidatePath("/dashboard/provider/services");
	revalidatePath("/dashboard/client/workrooms");
	revalidatePath("/dashboard/provider/workrooms");
	revalidatePath(`/dashboard/workrooms/${workroomId}`);
}

export async function completeWorkroomAction(
	workroomId: string,
	formData?: FormData,
) {
	const context = parseContext(formString(formData, "context"));
	const safeWorkroomId = isUuid(workroomId) ? workroomId : "";
	const redirectPath = safeWorkroomId
		? buildRedirectPath({ context, workroomId: safeWorkroomId, formData })
		: context === "provider-workroom-detail"
			? "/dashboard/provider/workrooms"
			: buildRedirectPath({ context, workroomId: "", formData });

	if (!safeWorkroomId) {
		redirectWithNotice(redirectPath, "workroomError", "Invalid workroom.");
	}

	const supabase = await createSupabaseServerClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/login");
	}

	const result = await completeWorkroomForProvider(
		supabase,
		user.id,
		safeWorkroomId,
	);

	if (result.error) {
		redirectWithNotice(redirectPath, "workroomError", result.error);
	}

	if (!result.data) {
		redirectWithNotice(
			redirectPath,
			"workroomError",
			"Workroom could not be completed.",
		);
		return;
	}

	revalidateWorkroomPaths(result.data.id);
	redirectWithNotice(
		buildRedirectPath({ context, workroomId: result.data.id, formData }),
		"workroomStatus",
		"Workroom marked completed.",
	);
}
