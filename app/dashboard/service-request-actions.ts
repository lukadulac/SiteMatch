"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
	acceptServiceRequestForProvider,
	cancelServiceRequestForClient,
	rejectServiceRequestForProvider,
} from "@/lib/provider-service-requests/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ServiceRequestActionContext =
	| "client-home"
	| "client-list"
	| "client-detail"
	| "provider-services"
	| "provider-list"
	| "provider-detail";

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
	if (
		value === "pending" ||
		value === "accepted" ||
		value === "rejected" ||
		value === "cancelled"
	) {
		return value;
	}

	return "all";
}

function parseContext(
	value: string,
	fallback: ServiceRequestActionContext,
): ServiceRequestActionContext {
	if (
		value === "client-home" ||
		value === "client-list" ||
		value === "client-detail" ||
		value === "provider-services" ||
		value === "provider-list" ||
		value === "provider-detail"
	) {
		return value;
	}

	return fallback;
}

function clampContextForAction({
	context,
	action,
}: {
	context: ServiceRequestActionContext;
	action: "provider-decision" | "client-cancel";
}) {
	if (action === "provider-decision") {
		return context === "provider-list" ||
			context === "provider-detail" ||
			context === "provider-services"
			? context
			: "provider-services";
	}

	return context === "client-list" ||
		context === "client-detail" ||
		context === "client-home"
		? context
		: "client-home";
}

function contextForInvalidRequestId(
	context: ServiceRequestActionContext,
	action: "provider-decision" | "client-cancel",
): ServiceRequestActionContext {
	if (context !== "provider-detail" && context !== "client-detail") {
		return context;
	}

	return action === "provider-decision" ? "provider-list" : "client-list";
}

function buildListPath(basePath: string, formData: FormData | undefined) {
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

	return query ? `${basePath}?${query}` : basePath;
}

function buildRedirectPath({
	context,
	requestId,
	formData,
}: {
	context: ServiceRequestActionContext;
	requestId: string;
	formData: FormData | undefined;
}) {
	switch (context) {
		case "client-list":
			return buildListPath("/dashboard/client/service-requests", formData);
		case "client-detail":
			return `/dashboard/service-requests/${requestId}`;
		case "provider-list":
			return buildListPath("/dashboard/provider/service-requests", formData);
		case "provider-detail":
			return `/dashboard/service-requests/${requestId}`;
		case "provider-services":
			return "/dashboard/provider/services";
		default:
			return "/dashboard/client";
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

function revalidateServiceRequestPaths(requestId: string) {
	revalidatePath("/dashboard/client");
	revalidatePath("/dashboard/provider");
	revalidatePath("/dashboard/provider/services");
	revalidatePath("/dashboard/client/service-requests");
	revalidatePath("/dashboard/provider/service-requests");
	revalidatePath("/dashboard/client/workrooms");
	revalidatePath("/dashboard/provider/workrooms");
	revalidatePath(`/dashboard/service-requests/${requestId}`);
	revalidatePath("/dashboard/messages");
}

function revalidateWorkroomPath(workroomId: string | null) {
	if (workroomId) {
		revalidatePath(`/dashboard/workrooms/${workroomId}`);
	}
}

export async function acceptServiceRequestAction(
	requestId: string,
	formData?: FormData,
) {
	const context = clampContextForAction({
		context: parseContext(
			formString(formData, "context"),
			"provider-services",
		),
		action: "provider-decision",
	});
	const safeRequestId = isUuid(requestId) ? requestId : "";
	const redirectPath = buildRedirectPath({
		context: safeRequestId
			? context
			: contextForInvalidRequestId(context, "provider-decision"),
		requestId: safeRequestId,
		formData,
	});

	if (!safeRequestId) {
		redirectWithNotice(redirectPath, "serviceError", "Invalid service request.");
	}

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
		redirectWithNotice(redirectPath, "serviceError", result.error);
	}

	if (!result.data) {
		redirectWithNotice(
			redirectPath,
			"serviceError",
			"Service request could not be accepted.",
		);
		return;
	}

	const acceptedRequest = result.data;

	revalidateServiceRequestPaths(acceptedRequest.id);
	revalidateWorkroomPath(acceptedRequest.workroom_id);
	redirectWithNotice(
		buildRedirectPath({
			context,
			requestId: acceptedRequest.id,
			formData,
		}),
		"serviceStatus",
		"Service request accepted.",
	);
}

export async function rejectServiceRequestAction(
	requestId: string,
	formData?: FormData,
) {
	const context = clampContextForAction({
		context: parseContext(
			formString(formData, "context"),
			"provider-services",
		),
		action: "provider-decision",
	});
	const safeRequestId = isUuid(requestId) ? requestId : "";
	const redirectPath = buildRedirectPath({
		context: safeRequestId
			? context
			: contextForInvalidRequestId(context, "provider-decision"),
		requestId: safeRequestId,
		formData,
	});

	if (!safeRequestId) {
		redirectWithNotice(redirectPath, "serviceError", "Invalid service request.");
	}

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
		redirectWithNotice(redirectPath, "serviceError", result.error);
	}

	if (!result.data) {
		redirectWithNotice(
			redirectPath,
			"serviceError",
			"Service request could not be rejected.",
		);
		return;
	}

	const rejectedRequest = result.data;

	revalidateServiceRequestPaths(rejectedRequest.id);
	redirectWithNotice(
		buildRedirectPath({
			context,
			requestId: rejectedRequest.id,
			formData,
		}),
		"serviceStatus",
		"Service request rejected.",
	);
}

export async function cancelServiceRequestAction(
	requestId: string,
	formData?: FormData,
) {
	const context = clampContextForAction({
		context: parseContext(formString(formData, "context"), "client-home"),
		action: "client-cancel",
	});
	const safeRequestId = isUuid(requestId) ? requestId : "";
	const redirectPath = buildRedirectPath({
		context: safeRequestId
			? context
			: contextForInvalidRequestId(context, "client-cancel"),
		requestId: safeRequestId,
		formData,
	});

	if (!safeRequestId) {
		redirectWithNotice(redirectPath, "serviceError", "Invalid service request.");
	}

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
		redirectWithNotice(redirectPath, "serviceError", result.error);
	}

	if (!result.data) {
		redirectWithNotice(
			redirectPath,
			"serviceError",
			"Service request could not be cancelled.",
		);
		return;
	}

	const cancelledRequest = result.data;

	revalidateServiceRequestPaths(cancelledRequest.id);
	redirectWithNotice(
		buildRedirectPath({
			context,
			requestId: cancelledRequest.id,
			formData,
		}),
		"serviceStatus",
		"Service request cancelled.",
	);
}
