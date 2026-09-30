import type { SupabaseClient } from "@supabase/supabase-js";
import {
	WORKROOM_PAGE_SIZE,
	WORKROOM_PREVIEW_LIMIT,
	type WorkroomListQuery,
	type WorkroomStatusFilter,
} from "@/lib/service-workrooms/schemas";
import type { Database } from "@/types/supabase";

type Result<T> =
	| { data: T; error?: never }
	| { data?: never; error: string };

type ServiceWorkroomRow =
	Database["public"]["Tables"]["service_workrooms"]["Row"];

export type ServiceWorkroomStatus =
	Database["public"]["Enums"]["service_workroom_status"];

export type ServiceWorkroomSummary = ServiceWorkroomRow & {
	conversation_id: string | null;
	service: Pick<
		Database["public"]["Tables"]["provider_service_listings"]["Row"],
		"id" | "title" | "status" | "price_type" | "starting_price"
	> | null;
	service_request: Pick<
		Database["public"]["Tables"]["provider_service_requests"]["Row"],
		"id" | "status" | "message" | "created_at"
	> | null;
	client: Pick<
		Database["public"]["Tables"]["profiles"]["Row"],
		"id" | "full_name" | "city" | "country"
	> | null;
	provider: Pick<
		Database["public"]["Tables"]["profiles"]["Row"],
		"id" | "full_name" | "city" | "country"
	> | null;
};

export type ServiceWorkroomDetail = ServiceWorkroomRow & {
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
	service_request: Pick<
		Database["public"]["Tables"]["provider_service_requests"]["Row"],
		"id" | "status" | "message" | "created_at" | "updated_at"
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

export type WorkroomPage<TWorkroom> = {
	workrooms: TWorkroom[];
	totalCount: number;
	page: number;
	pageSize: number;
	totalPages: number;
	status: WorkroomStatusFilter;
};

type CompleteWorkroomRpcRow = {
	workroom_id: string;
	workroom_status: ServiceWorkroomStatus;
};

type SupabaseClientWithWorkroomRpc = SupabaseClient<Database> & {
	rpc(
		fn: "complete_service_workroom",
		args: { target_workroom_id: string },
	): Promise<{
		data: CompleteWorkroomRpcRow[] | null;
		error: { message: string; code?: string } | null;
	}>;
};

const workroomSummarySelect =
	"id, service_request_id, service_id, client_id, provider_id, status, accepted_at, completed_at, created_at, updated_at, service:provider_service_listings!service_workrooms_service_id_fkey(id, title, status, price_type, starting_price), service_request:provider_service_requests!service_workrooms_service_request_id_fkey(id, status, message, created_at), client:profiles!service_workrooms_client_id_fkey(id, full_name, city, country), provider:profiles!service_workrooms_provider_id_fkey(id, full_name, city, country)";

const workroomDetailSelect =
	"id, service_request_id, service_id, client_id, provider_id, status, accepted_at, completed_at, created_at, updated_at, service:provider_service_listings!service_workrooms_service_id_fkey(id, title, description, status, price_type, starting_price, delivery_estimate, service_type_text, category_text, created_at, published_at), service_request:provider_service_requests!service_workrooms_service_request_id_fkey(id, status, message, created_at, updated_at), client:profiles!service_workrooms_client_id_fkey(id, full_name, email, phone, city, country), provider:profiles!service_workrooms_provider_id_fkey(id, full_name, email, phone, city, country)";

function normalizeTotalPages(totalCount: number, pageSize: number) {
	return totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize);
}

function isRangeNotSatisfiableError(message: string) {
	return message.toLowerCase().includes("range not satisfiable");
}

function buildWorkroomPage<TWorkroom>({
	workrooms,
	totalCount,
	page,
	pageSize,
	status,
}: {
	workrooms: TWorkroom[];
	totalCount: number;
	page: number;
	pageSize: number;
	status: WorkroomStatusFilter;
}): WorkroomPage<TWorkroom> {
	return {
		workrooms,
		totalCount,
		page,
		pageSize,
		totalPages: normalizeTotalPages(totalCount, pageSize),
		status,
	};
}

async function getConversationIdByServiceRequestIds(
	supabase: SupabaseClient<Database>,
	requestIds: string[],
): Promise<Result<Map<string, string>>> {
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

async function attachConversationIds<TWorkroom extends { service_request_id: string }>(
	supabase: SupabaseClient<Database>,
	workrooms: TWorkroom[],
): Promise<Result<Array<TWorkroom & { conversation_id: string | null }>>> {
	const conversationResult = await getConversationIdByServiceRequestIds(
		supabase,
		workrooms.map((workroom) => workroom.service_request_id),
	);

	if (conversationResult.error) {
		return { error: conversationResult.error };
	}

	const conversationByRequestId = conversationResult.data ?? new Map<string, string>();

	return {
		data: workrooms.map((workroom) => ({
			...workroom,
			conversation_id:
				conversationByRequestId.get(workroom.service_request_id) ?? null,
		})),
	};
}

async function countWorkrooms({
	supabase,
	userId,
	role,
	status,
}: {
	supabase: SupabaseClient<Database>;
	userId: string;
	role: "client" | "provider";
	status: WorkroomStatusFilter;
}): Promise<Result<number>> {
	const ownerColumn = role === "client" ? "client_id" : "provider_id";
	let query = supabase
		.from("service_workrooms")
		.select("id", { count: "exact", head: true })
		.eq(ownerColumn, userId);

	if (status !== "all") {
		query = query.eq("status", status);
	}

	const { error, count } = await query;

	if (error) {
		return { error: error.message };
	}

	return { data: count ?? 0 };
}

async function getWorkroomsPageWithOptions({
	supabase,
	userId,
	role,
	page,
	pageSize = WORKROOM_PAGE_SIZE,
	status = "all",
}: {
	supabase: SupabaseClient<Database>;
	userId: string;
	role: "client" | "provider";
	page?: number;
	pageSize?: number;
	status?: WorkroomStatusFilter;
}): Promise<Result<WorkroomPage<ServiceWorkroomSummary>>> {
	const normalizedPage = Math.max(1, page ?? 1);
	const offset = (normalizedPage - 1) * pageSize;
	const ownerColumn = role === "client" ? "client_id" : "provider_id";
	let query = supabase
		.from("service_workrooms")
		.select(workroomSummarySelect, { count: "exact" })
		.eq(ownerColumn, userId);

	if (status !== "all") {
		query = query.eq("status", status);
	}

	const { data, error, count } = await query
		.order("accepted_at", { ascending: false })
		.order("id", { ascending: false })
		.range(offset, offset + pageSize - 1);

	if (error) {
		if (isRangeNotSatisfiableError(error.message)) {
			const countResult = await countWorkrooms({
				supabase,
				userId,
				role,
				status,
			});

			if (countResult.error) {
				return { error: countResult.error };
			}

			return {
				data: buildWorkroomPage({
					workrooms: [],
					totalCount: countResult.data ?? 0,
					page: normalizedPage,
					pageSize,
					status,
				}),
			};
		}

		return { error: error.message };
	}

	const workroomRows = (data ?? []) as Omit<
		ServiceWorkroomSummary,
		"conversation_id"
	>[];
	const workroomsResult = await attachConversationIds(supabase, workroomRows);

	if (workroomsResult.error) {
		return { error: workroomsResult.error };
	}

	if (!workroomsResult.data) {
		return { error: "Workrooms could not be loaded." };
	}

	return {
		data: buildWorkroomPage({
			workrooms: workroomsResult.data,
			totalCount: count ?? 0,
			page: normalizedPage,
			pageSize,
			status,
		}),
	};
}

export async function getClientWorkroomsPage(
	supabase: SupabaseClient<Database>,
	userId: string,
	query: WorkroomListQuery,
) {
	return getWorkroomsPageWithOptions({
		supabase,
		userId,
		role: "client",
		page: query.page,
		pageSize: query.pageSize,
		status: query.status,
	});
}

export async function getProviderWorkroomsPage(
	supabase: SupabaseClient<Database>,
	userId: string,
	query: WorkroomListQuery,
) {
	return getWorkroomsPageWithOptions({
		supabase,
		userId,
		role: "provider",
		page: query.page,
		pageSize: query.pageSize,
		status: query.status,
	});
}

export async function getClientWorkroomPreview(
	supabase: SupabaseClient<Database>,
	userId: string,
): Promise<Result<ServiceWorkroomSummary[]>> {
	const result = await getWorkroomsPageWithOptions({
		supabase,
		userId,
		role: "client",
		page: 1,
		pageSize: WORKROOM_PREVIEW_LIMIT,
		status: "all",
	});

	if (result.error) {
		return { error: result.error };
	}

	return { data: result.data?.workrooms ?? [] };
}

export async function getProviderWorkroomPreview(
	supabase: SupabaseClient<Database>,
	userId: string,
): Promise<Result<ServiceWorkroomSummary[]>> {
	const result = await getWorkroomsPageWithOptions({
		supabase,
		userId,
		role: "provider",
		page: 1,
		pageSize: WORKROOM_PREVIEW_LIMIT,
		status: "all",
	});

	if (result.error) {
		return { error: result.error };
	}

	return { data: result.data?.workrooms ?? [] };
}

export async function getWorkroomDetailForParticipant(
	supabase: SupabaseClient<Database>,
	userId: string,
	workroomId: string,
): Promise<Result<ServiceWorkroomDetail | null>> {
	const { data, error } = await supabase
		.from("service_workrooms")
		.select(workroomDetailSelect)
		.eq("id", workroomId)
		.or(`client_id.eq.${userId},provider_id.eq.${userId}`)
		.maybeSingle();

	if (error) {
		return { error: error.message };
	}

	if (!data) {
		return { data: null };
	}

	const workroom = data as Omit<ServiceWorkroomDetail, "conversation_id">;
	const conversationResult = await getConversationIdByServiceRequestIds(
		supabase,
		[workroom.service_request_id],
	);

	if (conversationResult.error) {
		return { error: conversationResult.error };
	}

	return {
		data: {
			...workroom,
			conversation_id:
				conversationResult.data?.get(workroom.service_request_id) ?? null,
		},
	};
}

export async function completeWorkroomForProvider(
	supabase: SupabaseClient<Database>,
	_userId: string,
	workroomId: string,
): Promise<
	Result<{
		id: string;
		status: ServiceWorkroomStatus;
	}>
> {
	const { data, error } = await (supabase as SupabaseClientWithWorkroomRpc).rpc(
		"complete_service_workroom",
		{ target_workroom_id: workroomId },
	);

	if (error) {
		return { error: error.message };
	}

	const workroom = data?.[0];

	if (!workroom) {
		return { error: "Workroom could not be completed." };
	}

	return {
		data: {
			id: workroom.workroom_id,
			status: workroom.workroom_status,
		},
	};
}
