import type { SupabaseClient } from "@supabase/supabase-js";
import {
	createServiceRequestSchema,
	type CreateServiceRequestFormFields,
	type CreateServiceRequestInput,
} from "@/lib/provider-service-requests/schemas";
import type { Database } from "@/types/supabase";

type ServiceRequestResult<T> =
	| { data: T; error?: never }
	| {
			data?: never;
			error: string;
			fieldErrors?: Record<string, string[] | undefined>;
	  };

type ProviderServiceRequestRow =
	Database["public"]["Tables"]["provider_service_requests"]["Row"];

export type ProviderServiceRequestStatus =
	Database["public"]["Enums"]["provider_service_request_status"];

export type ActiveServiceRequest = Pick<
	ProviderServiceRequestRow,
	"id" | "status" | "created_at"
> & {
	conversation_id: string | null;
};

export type ClientServiceRequest = ProviderServiceRequestRow & {
	conversation_id: string | null;
	service: Pick<
		Database["public"]["Tables"]["provider_service_listings"]["Row"],
		"id" | "title" | "status" | "price_type" | "starting_price"
	> | null;
	provider: Pick<
		Database["public"]["Tables"]["profiles"]["Row"],
		"id" | "full_name" | "city" | "country"
	> | null;
};

export type ProviderIncomingServiceRequest = ProviderServiceRequestRow & {
	conversation_id: string | null;
	service: Pick<
		Database["public"]["Tables"]["provider_service_listings"]["Row"],
		"id" | "title" | "status" | "price_type" | "starting_price"
	> | null;
	client: Pick<
		Database["public"]["Tables"]["profiles"]["Row"],
		"id" | "full_name" | "city" | "country"
	> | null;
};

type ServiceRequestRpcRow = {
	request_id: string;
	request_status: ProviderServiceRequestStatus;
	conversation_id: string | null;
};

type SupabaseClientWithServiceRequestRpc = SupabaseClient<Database> & {
	rpc(
		fn: "request_provider_service",
		args: { target_service_id: string; request_message: string },
	): Promise<{
		data: ServiceRequestRpcRow[] | null;
		error: { message: string; code?: string } | null;
	}>;
	rpc(
		fn:
			| "accept_provider_service_request"
			| "reject_provider_service_request"
			| "cancel_provider_service_request",
		args: { target_request_id: string },
	): Promise<{
		data: ServiceRequestRpcRow[] | null;
		error: { message: string; code?: string } | null;
	}>;
};

const serviceRequestListSelect =
	"id, service_id, client_id, provider_id, status, message, created_at, updated_at, service:provider_service_listings!provider_service_requests_service_id_fkey(id, title, status, price_type, starting_price)";

async function getUserRole(
	supabase: SupabaseClient<Database>,
	userId: string,
): Promise<ServiceRequestResult<Database["public"]["Enums"]["user_role"]>> {
	const { data: profile, error } = await supabase
		.from("profiles")
		.select("role")
		.eq("id", userId)
		.maybeSingle();

	if (error) {
		return { error: error.message };
	}

	if (!profile?.role) {
		return { error: "Your marketplace profile could not be found." };
	}

	return { data: profile.role };
}

export async function getActiveServiceRequest(
	supabase: SupabaseClient<Database>,
	userId: string,
	serviceId: string,
): Promise<ServiceRequestResult<ActiveServiceRequest | null>> {
	const { data, error } = await supabase
		.from("provider_service_requests")
		.select("id, status, created_at")
		.eq("client_id", userId)
		.eq("service_id", serviceId)
		.order("created_at", { ascending: false })
		.limit(1)
		.maybeSingle();

	if (error) {
		return { error: error.message };
	}

	if (!data) {
		return { data: null };
	}

	const conversationResult = await getConversationIdByServiceRequestIds(
		supabase,
		[data.id],
	);

	if (conversationResult.error) {
		return { error: conversationResult.error };
	}

	const conversationByRequestId = conversationResult.data ?? new Map<string, string>();

	return {
		data: {
			...data,
			conversation_id: conversationByRequestId.get(data.id) ?? null,
		},
	};
}

async function getConversationIdByServiceRequestIds(
	supabase: SupabaseClient<Database>,
	requestIds: string[],
): Promise<ServiceRequestResult<Map<string, string>>> {
	if (requestIds.length === 0) {
		return { data: new Map() };
	}

	const { data, error } = await supabase
		.from("conversations")
		.select("id, service_request_id")
		.in("service_request_id", requestIds);

	if (error) {
		return { error: error.message };
	}

	const conversationByRequestId = new Map<string, string>();

	for (const conversation of data ?? []) {
		if (conversation.service_request_id) {
			conversationByRequestId.set(conversation.service_request_id, conversation.id);
		}
	}

	return { data: conversationByRequestId };
}

function mapServiceRequestRpcError(message: string) {
	if (message.includes("already requested")) {
		return "You already requested this service.";
	}

	return message;
}

function mapServiceRequestRpcRow(row: ServiceRequestRpcRow) {
	return {
		id: row.request_id,
		status: row.request_status,
		conversation_id: row.conversation_id,
	};
}

export async function createServiceRequest(
	supabase: SupabaseClient<Database>,
	userId: string,
	serviceId: string,
	input: CreateServiceRequestInput | CreateServiceRequestFormFields,
): Promise<
	ServiceRequestResult<{
		id: string;
		status: ProviderServiceRequestStatus;
		conversation_id: string | null;
	}>
> {
	const roleResult = await getUserRole(supabase, userId);

	if (roleResult.error) {
		return { error: roleResult.error };
	}

	if (roleResult.data !== "client") {
		return { error: "Only clients can request provider services." };
	}

	const parsed = createServiceRequestSchema.safeParse(input);

	if (!parsed.success) {
		return {
			error: "Please fix the highlighted fields.",
			fieldErrors: parsed.error.flatten().fieldErrors,
		};
	}

	const { data: createdRows, error } = await (
		supabase as SupabaseClientWithServiceRequestRpc
	).rpc("request_provider_service", {
		target_service_id: serviceId,
		request_message: parsed.data.message,
	});

	if (error) {
		return { error: mapServiceRequestRpcError(error.message) };
	}

	const createdRequest = createdRows?.[0];

	if (!createdRequest) {
		return { error: "Service request could not be created." };
	}

	return { data: mapServiceRequestRpcRow(createdRequest) };
}

export async function getClientServiceRequests(
	supabase: SupabaseClient<Database>,
	userId: string,
): Promise<ServiceRequestResult<ClientServiceRequest[]>> {
	const { data, error } = await supabase
		.from("provider_service_requests")
		.select(
			`${serviceRequestListSelect}, provider:profiles!provider_service_requests_provider_id_fkey(id, full_name, city, country)`,
		)
		.eq("client_id", userId)
		.order("created_at", { ascending: false });

	if (error) {
		return { error: error.message };
	}

	const requestRows = (data ?? []) as Omit<
		ClientServiceRequest,
		"conversation_id"
	>[];
	const conversationResult = await getConversationIdByServiceRequestIds(
		supabase,
		requestRows.map((request) => request.id),
	);

	if (conversationResult.error) {
		return { error: conversationResult.error };
	}

	const conversationByRequestId = conversationResult.data ?? new Map<string, string>();

	return {
		data: requestRows.map((request) => ({
			...request,
			conversation_id: conversationByRequestId.get(request.id) ?? null,
		})),
	};
}

export async function getProviderIncomingServiceRequests(
	supabase: SupabaseClient<Database>,
	userId: string,
): Promise<ServiceRequestResult<ProviderIncomingServiceRequest[]>> {
	const { data, error } = await supabase
		.from("provider_service_requests")
		.select(
			`${serviceRequestListSelect}, client:profiles!provider_service_requests_client_id_fkey(id, full_name, city, country)`,
		)
		.eq("provider_id", userId)
		.order("created_at", { ascending: false });

	if (error) {
		return { error: error.message };
	}

	const requestRows = (data ?? []) as Omit<
		ProviderIncomingServiceRequest,
		"conversation_id"
	>[];
	const conversationResult = await getConversationIdByServiceRequestIds(
		supabase,
		requestRows.map((request) => request.id),
	);

	if (conversationResult.error) {
		return { error: conversationResult.error };
	}

	const conversationByRequestId = conversationResult.data ?? new Map<string, string>();

	return {
		data: requestRows.map((request) => ({
			...request,
			conversation_id: conversationByRequestId.get(request.id) ?? null,
		})),
	};
}

export async function acceptServiceRequestForProvider(
	supabase: SupabaseClient<Database>,
	_userId: string,
	requestId: string,
): Promise<
	ServiceRequestResult<{
		id: string;
		status: ProviderServiceRequestStatus;
		conversation_id: string | null;
	}>
> {
	const { data, error } = await (
		supabase as SupabaseClientWithServiceRequestRpc
	).rpc("accept_provider_service_request", {
		target_request_id: requestId,
	});

	if (error) {
		return { error: error.message };
	}

	const request = data?.[0];

	if (!request) {
		return { error: "Service request could not be accepted." };
	}

	return { data: mapServiceRequestRpcRow(request) };
}

export async function rejectServiceRequestForProvider(
	supabase: SupabaseClient<Database>,
	_userId: string,
	requestId: string,
): Promise<
	ServiceRequestResult<{
		id: string;
		status: ProviderServiceRequestStatus;
		conversation_id: string | null;
	}>
> {
	const { data, error } = await (
		supabase as SupabaseClientWithServiceRequestRpc
	).rpc("reject_provider_service_request", {
		target_request_id: requestId,
	});

	if (error) {
		return { error: error.message };
	}

	const request = data?.[0];

	if (!request) {
		return { error: "Service request could not be rejected." };
	}

	return { data: mapServiceRequestRpcRow(request) };
}

export async function cancelServiceRequestForClient(
	supabase: SupabaseClient<Database>,
	_userId: string,
	requestId: string,
): Promise<
	ServiceRequestResult<{
		id: string;
		status: ProviderServiceRequestStatus;
		conversation_id: string | null;
	}>
> {
	const { data, error } = await (
		supabase as SupabaseClientWithServiceRequestRpc
	).rpc("cancel_provider_service_request", {
		target_request_id: requestId,
	});

	if (error) {
		return { error: error.message };
	}

	const request = data?.[0];

	if (!request) {
		return { error: "Service request could not be cancelled." };
	}

	return { data: mapServiceRequestRpcRow(request) };
}
