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
>;

export type ClientServiceRequest = ProviderServiceRequestRow & {
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
	service: Pick<
		Database["public"]["Tables"]["provider_service_listings"]["Row"],
		"id" | "title" | "status" | "price_type" | "starting_price"
	> | null;
	client: Pick<
		Database["public"]["Tables"]["profiles"]["Row"],
		"id" | "full_name" | "city" | "country"
	> | null;
};

const activeServiceRequestStatuses: ProviderServiceRequestStatus[] = [
	"pending",
	"accepted",
];

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
		.in("status", activeServiceRequestStatuses)
		.order("created_at", { ascending: false })
		.limit(1)
		.maybeSingle();

	if (error) {
		return { error: error.message };
	}

	return { data: data ?? null };
}

export async function createServiceRequest(
	supabase: SupabaseClient<Database>,
	userId: string,
	serviceId: string,
	input: CreateServiceRequestInput | CreateServiceRequestFormFields,
): Promise<ServiceRequestResult<ProviderServiceRequestRow>> {
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

	const { data: service, error: serviceError } = await supabase
		.from("provider_service_listings")
		.select("id, provider_id, status")
		.eq("id", serviceId)
		.maybeSingle();

	if (serviceError) {
		return { error: serviceError.message };
	}

	if (!service || service.status !== "published") {
		return { error: "Service is not available for requests." };
	}

	if (service.provider_id === userId) {
		return { error: "You cannot request your own service." };
	}

	const { data: request, error: insertError } = await supabase
		.from("provider_service_requests")
		.insert({
			service_id: service.id,
			client_id: userId,
			provider_id: service.provider_id,
			message: parsed.data.message,
			status: "pending",
		})
		.select("*")
		.single();

	if (insertError) {
		if (insertError.code === "23505") {
			return { error: "You already have an active request for this service." };
		}

		return { error: insertError.message };
	}

	return { data: request };
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

	return { data: (data ?? []) as ClientServiceRequest[] };
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

	return { data: (data ?? []) as ProviderIncomingServiceRequest[] };
}
