import type { SupabaseClient } from "@supabase/supabase-js";
import {
	createServiceRequestSchema,
	SERVICE_REQUEST_PAGE_SIZE,
	SERVICE_REQUEST_PREVIEW_LIMIT,
	type CreateServiceRequestFormFields,
	type CreateServiceRequestInput,
	type ServiceRequestListQuery,
	type ServiceRequestStatusFilter,
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

export type ServiceRequestPage<TRequest> = {
	requests: TRequest[];
	totalCount: number;
	page: number;
	pageSize: number;
	totalPages: number;
	status: ServiceRequestStatusFilter;
};

export type ServiceRequestDetail = ProviderServiceRequestRow & {
	conversation_id: string | null;
	service: Pick<
		Database["public"]["Tables"]["provider_service_listings"]["Row"],
		| "id"
		| "title"
		| "description"
		| "status"
		| "price_type"
		| "starting_price"
		| "delivery_estimate"
		| "service_type_text"
		| "category_text"
		| "created_at"
		| "published_at"
	> | null;
	client: Pick<
		Database["public"]["Tables"]["profiles"]["Row"],
		"id" | "full_name" | "email" | "phone" | "city" | "country"
	> | null;
	provider: Pick<
		Database["public"]["Tables"]["profiles"]["Row"],
		"id" | "full_name" | "email" | "phone" | "city" | "country"
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

const serviceRequestDetailSelect =
	"id, service_id, client_id, provider_id, status, message, created_at, updated_at, service:provider_service_listings!provider_service_requests_service_id_fkey(id, title, description, status, price_type, starting_price, delivery_estimate, service_type_text, category_text, created_at, published_at), client:profiles!provider_service_requests_client_id_fkey(id, full_name, email, phone, city, country), provider:profiles!provider_service_requests_provider_id_fkey(id, full_name, email, phone, city, country)";

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

function normalizeTotalPages(totalCount: number, pageSize: number) {
	return totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize);
}

function isRangeNotSatisfiableError(message: string) {
	return message.toLowerCase().includes("range not satisfiable");
}

function buildServiceRequestPage<TRequest>({
	requests,
	totalCount,
	page,
	pageSize,
	status,
}: {
	requests: TRequest[];
	totalCount: number;
	page: number;
	pageSize: number;
	status: ServiceRequestStatusFilter;
}): ServiceRequestPage<TRequest> {
	return {
		requests,
		totalCount,
		page,
		pageSize,
		totalPages: normalizeTotalPages(totalCount, pageSize),
		status,
	};
}

async function countClientServiceRequests(
	supabase: SupabaseClient<Database>,
	userId: string,
	status: ServiceRequestStatusFilter,
): Promise<ServiceRequestResult<number>> {
	let query = supabase
		.from("provider_service_requests")
		.select("id", { count: "exact", head: true })
		.eq("client_id", userId);

	if (status !== "all") {
		query = query.eq("status", status);
	}

	const { error, count } = await query;

	if (error) {
		return { error: error.message };
	}

	return { data: count ?? 0 };
}

async function countProviderServiceRequests(
	supabase: SupabaseClient<Database>,
	userId: string,
	status: ServiceRequestStatusFilter,
): Promise<ServiceRequestResult<number>> {
	let query = supabase
		.from("provider_service_requests")
		.select("id", { count: "exact", head: true })
		.eq("provider_id", userId);

	if (status !== "all") {
		query = query.eq("status", status);
	}

	const { error, count } = await query;

	if (error) {
		return { error: error.message };
	}

	return { data: count ?? 0 };
}

async function attachConversationIds<
	TRequest extends { id: string },
>(
	supabase: SupabaseClient<Database>,
	requests: TRequest[],
): Promise<ServiceRequestResult<Array<TRequest & { conversation_id: string | null }>>> {
	const conversationResult = await getConversationIdByServiceRequestIds(
		supabase,
		requests.map((request) => request.id),
	);

	if (conversationResult.error) {
		return { error: conversationResult.error };
	}

	const conversationByRequestId = conversationResult.data ?? new Map<string, string>();

	return {
		data: requests.map((request) => ({
			...request,
			conversation_id: conversationByRequestId.get(request.id) ?? null,
		})),
	};
}

type ServiceRequestListOptions = {
	page?: number;
	pageSize?: number;
	status?: ServiceRequestStatusFilter;
};

async function getClientServiceRequestsPageWithOptions(
	supabase: SupabaseClient<Database>,
	userId: string,
	options: ServiceRequestListOptions,
): Promise<ServiceRequestResult<ServiceRequestPage<ClientServiceRequest>>> {
	const page = Math.max(1, options.page ?? 1);
	const pageSize = options.pageSize ?? SERVICE_REQUEST_PAGE_SIZE;
	const status = options.status ?? "all";
	const offset = (page - 1) * pageSize;
	let query = supabase
		.from("provider_service_requests")
		.select(
			`${serviceRequestListSelect}, provider:profiles!provider_service_requests_provider_id_fkey(id, full_name, city, country)`,
			{ count: "exact" },
		)
		.eq("client_id", userId);

	if (status !== "all") {
		query = query.eq("status", status);
	}

	const { data, error, count } = await query
		.order("created_at", { ascending: false })
		.order("id", { ascending: false })
		.range(offset, offset + pageSize - 1);

	if (error) {
		if (isRangeNotSatisfiableError(error.message)) {
			const countResult = await countClientServiceRequests(supabase, userId, status);

			if (countResult.error) {
				return { error: countResult.error };
			}

			return {
				data: buildServiceRequestPage({
					requests: [],
					totalCount: countResult.data ?? 0,
					page,
					pageSize,
					status,
				}),
			};
		}

		return { error: error.message };
	}

	const requestRows = (data ?? []) as Omit<
		ClientServiceRequest,
		"conversation_id"
	>[];
	const requestsResult = await attachConversationIds(supabase, requestRows);

	if (requestsResult.error) {
		return { error: requestsResult.error };
	}

	if (!requestsResult.data) {
		return { error: "Service requests could not be loaded." };
	}

	return {
		data: buildServiceRequestPage({
			requests: requestsResult.data,
			totalCount: count ?? 0,
			page,
			pageSize,
			status,
		}),
	};
}

async function getProviderServiceRequestsPageWithOptions(
	supabase: SupabaseClient<Database>,
	userId: string,
	options: ServiceRequestListOptions,
): Promise<ServiceRequestResult<ServiceRequestPage<ProviderIncomingServiceRequest>>> {
	const page = Math.max(1, options.page ?? 1);
	const pageSize = options.pageSize ?? SERVICE_REQUEST_PAGE_SIZE;
	const status = options.status ?? "all";
	const offset = (page - 1) * pageSize;
	let query = supabase
		.from("provider_service_requests")
		.select(
			`${serviceRequestListSelect}, client:profiles!provider_service_requests_client_id_fkey(id, full_name, city, country)`,
			{ count: "exact" },
		)
		.eq("provider_id", userId);

	if (status !== "all") {
		query = query.eq("status", status);
	}

	const { data, error, count } = await query
		.order("created_at", { ascending: false })
		.order("id", { ascending: false })
		.range(offset, offset + pageSize - 1);

	if (error) {
		if (isRangeNotSatisfiableError(error.message)) {
			const countResult = await countProviderServiceRequests(supabase, userId, status);

			if (countResult.error) {
				return { error: countResult.error };
			}

			return {
				data: buildServiceRequestPage({
					requests: [],
					totalCount: countResult.data ?? 0,
					page,
					pageSize,
					status,
				}),
			};
		}

		return { error: error.message };
	}

	const requestRows = (data ?? []) as Omit<
		ProviderIncomingServiceRequest,
		"conversation_id"
	>[];
	const requestsResult = await attachConversationIds(supabase, requestRows);

	if (requestsResult.error) {
		return { error: requestsResult.error };
	}

	if (!requestsResult.data) {
		return { error: "Service requests could not be loaded." };
	}

	return {
		data: buildServiceRequestPage({
			requests: requestsResult.data,
			totalCount: count ?? 0,
			page,
			pageSize,
			status,
		}),
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
	const result = await getClientServiceRequestsPageWithOptions(
		supabase,
		userId,
		{
			page: 1,
			pageSize: 1000,
			status: "all",
		},
	);

	if (result.error) {
		return { error: result.error };
	}

	if (!result.data) {
		return { error: "Service requests could not be loaded." };
	}

	return { data: result.data.requests };
}

export async function getProviderIncomingServiceRequests(
	supabase: SupabaseClient<Database>,
	userId: string,
): Promise<ServiceRequestResult<ProviderIncomingServiceRequest[]>> {
	const result = await getProviderServiceRequestsPageWithOptions(
		supabase,
		userId,
		{
			page: 1,
			pageSize: 1000,
			status: "all",
		},
	);

	if (result.error) {
		return { error: result.error };
	}

	if (!result.data) {
		return { error: "Service requests could not be loaded." };
	}

	return { data: result.data.requests };
}

export async function getClientServiceRequestsPage(
	supabase: SupabaseClient<Database>,
	userId: string,
	query: ServiceRequestListQuery,
): Promise<ServiceRequestResult<ServiceRequestPage<ClientServiceRequest>>> {
	return getClientServiceRequestsPageWithOptions(supabase, userId, query);
}

export async function getProviderServiceRequestsPage(
	supabase: SupabaseClient<Database>,
	userId: string,
	query: ServiceRequestListQuery,
): Promise<ServiceRequestResult<ServiceRequestPage<ProviderIncomingServiceRequest>>> {
	return getProviderServiceRequestsPageWithOptions(supabase, userId, query);
}

export async function getClientServiceRequestPreview(
	supabase: SupabaseClient<Database>,
	userId: string,
): Promise<ServiceRequestResult<ClientServiceRequest[]>> {
	const result = await getClientServiceRequestsPageWithOptions(
		supabase,
		userId,
		{
			page: 1,
			pageSize: SERVICE_REQUEST_PREVIEW_LIMIT,
			status: "all",
		},
	);

	if (result.error) {
		return { error: result.error };
	}

	if (!result.data) {
		return { error: "Service requests could not be loaded." };
	}

	return { data: result.data.requests };
}

export async function getProviderServiceRequestPreview(
	supabase: SupabaseClient<Database>,
	userId: string,
): Promise<ServiceRequestResult<ProviderIncomingServiceRequest[]>> {
	const result = await getProviderServiceRequestsPageWithOptions(
		supabase,
		userId,
		{
			page: 1,
			pageSize: SERVICE_REQUEST_PREVIEW_LIMIT,
			status: "all",
		},
	);

	if (result.error) {
		return { error: result.error };
	}

	if (!result.data) {
		return { error: "Service requests could not be loaded." };
	}

	return { data: result.data.requests };
}

export async function getServiceRequestDetailForParticipant(
	supabase: SupabaseClient<Database>,
	userId: string,
	requestId: string,
): Promise<ServiceRequestResult<ServiceRequestDetail | null>> {
	const { data, error } = await supabase
		.from("provider_service_requests")
		.select(serviceRequestDetailSelect)
		.eq("id", requestId)
		.or(`client_id.eq.${userId},provider_id.eq.${userId}`)
		.maybeSingle();

	if (error) {
		return { error: error.message };
	}

	if (!data) {
		return { data: null };
	}

	const request = data as Omit<ServiceRequestDetail, "conversation_id">;
	const conversationResult = await getConversationIdByServiceRequestIds(
		supabase,
		[request.id],
	);

	if (conversationResult.error) {
		return { error: conversationResult.error };
	}

	return {
		data: {
			...request,
			conversation_id:
				conversationResult.data?.get(request.id) ?? null,
		},
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
