import { describe, expect, it } from "vitest";
import {
	acceptServiceRequestForProvider,
	cancelServiceRequestForClient,
	createServiceRequest,
	getClientServiceRequestPreview,
	getClientServiceRequestsPage,
	getProviderServiceRequestsPage,
	getServiceRequestDetailForParticipant,
	rejectServiceRequestForProvider,
} from "@/lib/provider-service-requests/service";
import { parseServiceRequestListQuery } from "@/lib/provider-service-requests/schemas";
import { createSupabaseStub } from "../helpers/supabase-stub";

const CLIENT_ID = "client-1";
const PROVIDER_ID = "provider-1";
const SERVICE_ID = "service-1";
const REQUEST_ID = "11111111-1111-4111-8111-111111111111";
const CONVERSATION_ID = "22222222-2222-4222-8222-222222222222";

const CLIENT_ROLE = { data: { role: "client" } };
const PROVIDER_ROLE = { data: { role: "provider" } };

function requestRpcRow(overrides: Record<string, unknown> = {}) {
	return {
		request_id: REQUEST_ID,
		request_status: "pending",
		conversation_id: CONVERSATION_ID,
		...overrides,
	};
}

function requestRow(overrides: Record<string, unknown> = {}) {
	return {
		id: REQUEST_ID,
		service_id: SERVICE_ID,
		client_id: CLIENT_ID,
		provider_id: PROVIDER_ID,
		status: "pending",
		message: "We need this service for a launch next month.",
		created_at: "2026-01-02T00:00:00.000Z",
		updated_at: "2026-01-02T00:00:00.000Z",
		service: {
			id: SERVICE_ID,
			title: "Brand identity",
			status: "published",
			price_type: "fixed",
			starting_price: 1200,
		},
		...overrides,
	};
}

function conversationRow(requestId = REQUEST_ID) {
	return {
		id: CONVERSATION_ID,
		service_request_id: requestId,
	};
}

describe("createServiceRequest", () => {
	it("creates a pending request for a published service as the authenticated client", async () => {
		const stub = createSupabaseStub({
			"profiles.select": CLIENT_ROLE,
			"rpc.request_provider_service": { data: [requestRpcRow()] },
		});

		const result = await createServiceRequest(stub.client, CLIENT_ID, SERVICE_ID, {
			message: "We need this service for a launch next month.",
		});

		expect(result.data).toEqual({
			id: REQUEST_ID,
			status: "pending",
			conversation_id: CONVERSATION_ID,
			workroom_id: null,
		});
		expect(stub.callsFor("rpc.request_provider_service")[0]?.payload).toEqual({
			target_service_id: SERVICE_ID,
			request_message: "We need this service for a launch next month.",
		});
	});

	it("rejects non-client users before reading the service", async () => {
		const stub = createSupabaseStub({
			"profiles.select": PROVIDER_ROLE,
		});

		const result = await createServiceRequest(stub.client, PROVIDER_ID, SERVICE_ID, {
			message: "I want to request this.",
		});

		expect(result.error).toBe("Only clients can request provider services.");
		expect(stub.callKeys()).not.toContain("provider_service_listings.select");
		expect(stub.callKeys()).not.toContain("rpc.request_provider_service");
	});

	it("rejects a missing marketplace profile", async () => {
		const stub = createSupabaseStub({
			"profiles.select": { data: null },
		});

		const result = await createServiceRequest(stub.client, CLIENT_ID, SERVICE_ID, {
			message: "I want to request this.",
		});

		expect(result.error).toBe("Your marketplace profile could not be found.");
		expect(stub.callKeys()).not.toContain("rpc.request_provider_service");
	});

	it("validates the required request message", async () => {
		const stub = createSupabaseStub({
			"profiles.select": CLIENT_ROLE,
		});

		const result = await createServiceRequest(stub.client, CLIENT_ID, SERVICE_ID, {
			message: "short",
		});

		expect(result.error).toBe("Please fix the highlighted fields.");
		if (result.error) {
			expect(result.fieldErrors?.message?.[0]).toMatch(/at least 10/);
		}
		expect(stub.callKeys()).not.toContain("provider_service_listings.select");
		expect(stub.callKeys()).not.toContain("rpc.request_provider_service");
	});

	it("rejects draft or paused services", async () => {
		const stub = createSupabaseStub({
			"profiles.select": CLIENT_ROLE,
			"rpc.request_provider_service": {
				error: { message: "Service is not available for requests." },
			},
		});

		const result = await createServiceRequest(stub.client, CLIENT_ID, SERVICE_ID, {
			message: "We need this service for a launch next month.",
		});

		expect(result.error).toBe("Service is not available for requests.");
	});

	it("rejects nonexistent services", async () => {
		const stub = createSupabaseStub({
			"profiles.select": CLIENT_ROLE,
			"rpc.request_provider_service": {
				error: { message: "Service is not available for requests." },
			},
		});

		const result = await createServiceRequest(stub.client, CLIENT_ID, SERVICE_ID, {
			message: "We need this service for a launch next month.",
		});

		expect(result.error).toBe("Service is not available for requests.");
	});

	it("rejects the service owner", async () => {
		const stub = createSupabaseStub({
			"profiles.select": CLIENT_ROLE,
			"rpc.request_provider_service": {
				error: { message: "You cannot request your own service." },
			},
		});

		const result = await createServiceRequest(stub.client, CLIENT_ID, SERVICE_ID, {
			message: "We need this service for a launch next month.",
		});

		expect(result.error).toBe("You cannot request your own service.");
	});

	it("maps a duplicate request error to a friendly error", async () => {
		const stub = createSupabaseStub({
			"profiles.select": CLIENT_ROLE,
			"rpc.request_provider_service": {
				error: { message: "You already requested this service." },
			},
		});

		const result = await createServiceRequest(stub.client, CLIENT_ID, SERVICE_ID, {
			message: "We need this service for a launch next month.",
		});

		expect(result.error).toBe("You already requested this service.");
	});

	it("derives the provider from the service instead of trusting caller input", async () => {
		const stub = createSupabaseStub({
			"profiles.select": CLIENT_ROLE,
			"rpc.request_provider_service": { data: [requestRpcRow()] },
		});

		await createServiceRequest(stub.client, CLIENT_ID, SERVICE_ID, {
			message: "We need this service for a launch next month.",
			provider_id: "attacker-provider",
		} as never);

		expect(stub.callsFor("rpc.request_provider_service")[0]?.payload).toEqual({
			target_service_id: SERVICE_ID,
			request_message: "We need this service for a launch next month.",
		});
	});
});

describe("parseServiceRequestListQuery", () => {
	it("normalizes valid status and page values", () => {
		expect(
			parseServiceRequestListQuery({ status: "accepted", page: "3" }),
		).toEqual({
			status: "accepted",
			page: 3,
			pageSize: 10,
			offset: 20,
			wasNormalized: false,
		});
	});

	it("falls back safely for invalid status and page values", () => {
		expect(parseServiceRequestListQuery({ status: "open", page: "-2" })).toEqual({
			status: "all",
			page: 1,
			pageSize: 10,
			offset: 0,
			wasNormalized: true,
		});
	});

	it("marks explicit all as normalized so canonical URLs can omit it", () => {
		expect(parseServiceRequestListQuery({ status: "all" })).toEqual({
			status: "all",
			page: 1,
			pageSize: 10,
			offset: 0,
			wasNormalized: true,
		});
	});
});

describe("service request list queries", () => {
	it("returns a paginated client page with count, status filter, stable sort, and conversation id", async () => {
		const stub = createSupabaseStub({
			"provider_service_requests.select": {
				data: [requestRow({ provider: { id: PROVIDER_ID, full_name: "Provider" } })],
				count: 12,
			},
			"conversations.select": { data: [conversationRow()] },
		});

			const result = await getClientServiceRequestsPage(stub.client, CLIENT_ID, {
				status: "pending",
				page: 2,
				pageSize: 10,
				offset: 10,
				wasNormalized: false,
			});

		expect(result.data?.totalCount).toBe(12);
		expect(result.data?.totalPages).toBe(2);
		expect(result.data?.requests[0]?.conversation_id).toBe(CONVERSATION_ID);
		expect(stub.callsFor("provider_service_requests.select")[0]?.filters).toEqual(
			expect.arrayContaining([
				{ method: "eq", args: ["client_id", CLIENT_ID] },
				{ method: "eq", args: ["status", "pending"] },
				{ method: "order", args: ["created_at", { ascending: false }] },
				{ method: "order", args: ["id", { ascending: false }] },
				{ method: "range", args: [10, 19] },
			]),
		);
	});

	it("does not add a status filter for all requests", async () => {
		const stub = createSupabaseStub({
			"provider_service_requests.select": { data: [], count: 0 },
			"conversations.select": { data: [] },
		});

			await getClientServiceRequestsPage(stub.client, CLIENT_ID, {
				status: "all",
				page: 1,
				pageSize: 10,
				offset: 0,
				wasNormalized: false,
			});

		const filters = stub.callsFor("provider_service_requests.select")[0]?.filters;

		expect(filters).toContainEqual({ method: "eq", args: ["client_id", CLIENT_ID] });
		expect(filters).not.toContainEqual({ method: "eq", args: ["status", "all"] });
	});

	it("returns a paginated provider page scoped to the provider", async () => {
		const stub = createSupabaseStub({
			"provider_service_requests.select": {
				data: [requestRow({ client: { id: CLIENT_ID, full_name: "Client" } })],
				count: 1,
			},
			"conversations.select": { data: [conversationRow()] },
		});

		const result = await getProviderServiceRequestsPage(stub.client, PROVIDER_ID, {
			status: "rejected",
			page: 1,
			pageSize: 10,
			offset: 0,
			wasNormalized: false,
		});

		expect(result.data?.requests).toHaveLength(1);
		expect(stub.callsFor("provider_service_requests.select")[0]?.filters).toEqual(
			expect.arrayContaining([
				{ method: "eq", args: ["provider_id", PROVIDER_ID] },
				{ method: "eq", args: ["status", "rejected"] },
				{ method: "range", args: [0, 9] },
			]),
		);
	});

	it("returns page metadata when the requested provider page is out of range", async () => {
		const stub = createSupabaseStub({
			"provider_service_requests.select": [
				{
					error: { message: "Requested range not satisfiable" },
				},
				{
					data: null,
					count: 11,
				},
			],
		});

		const result = await getProviderServiceRequestsPage(stub.client, PROVIDER_ID, {
			status: "all",
			page: 99,
			pageSize: 10,
			offset: 980,
			wasNormalized: false,
		});

		expect(result.data).toMatchObject({
			requests: [],
			totalCount: 11,
			totalPages: 2,
			page: 99,
		});
		expect(stub.callsFor("provider_service_requests.select")[1]?.filters).toEqual(
			expect.arrayContaining([
				{ method: "eq", args: ["provider_id", PROVIDER_ID] },
			]),
		);
	});

	it("loads only three rows for the client dashboard preview", async () => {
		const stub = createSupabaseStub({
			"provider_service_requests.select": {
				data: [requestRow()],
				count: 4,
			},
			"conversations.select": { data: [conversationRow()] },
		});

		await getClientServiceRequestPreview(stub.client, CLIENT_ID);

		expect(stub.callsFor("provider_service_requests.select")[0]?.filters).toContainEqual({
			method: "range",
			args: [0, 2],
		});
	});
});

describe("getServiceRequestDetailForParticipant", () => {
	it("returns the detail when the user is a request participant", async () => {
		const stub = createSupabaseStub({
			"provider_service_requests.select": {
				data: requestRow({
					client: { id: CLIENT_ID, full_name: "Client" },
					provider: { id: PROVIDER_ID, full_name: "Provider" },
				}),
			},
			"conversations.select": { data: [conversationRow()] },
			"service_workrooms.select": {
				data: [{ id: "workroom-1", service_request_id: REQUEST_ID }],
			},
		});

		const result = await getServiceRequestDetailForParticipant(
			stub.client,
			CLIENT_ID,
			REQUEST_ID,
		);

		expect(result.data?.id).toBe(REQUEST_ID);
		expect(result.data?.conversation_id).toBe(CONVERSATION_ID);
		expect(result.data?.workroom_id).toBe("workroom-1");
		expect(stub.callsFor("provider_service_requests.select")[0]?.filters).toEqual(
			expect.arrayContaining([
				{ method: "eq", args: ["id", REQUEST_ID] },
				{
					method: "or",
					args: [`client_id.eq.${CLIENT_ID},provider_id.eq.${CLIENT_ID}`],
				},
			]),
		);
	});

	it("returns null for nonexistent or unauthorized requests without loading conversations", async () => {
		const stub = createSupabaseStub({
			"provider_service_requests.select": { data: null },
		});

		const result = await getServiceRequestDetailForParticipant(
			stub.client,
			"outsider-1",
			REQUEST_ID,
		);

		expect(result.data).toBeNull();
		expect(stub.callKeys()).not.toContain("conversations.select");
	});
});

describe("provider service request decisions", () => {
	it("accepts a pending request through the database function", async () => {
		const stub = createSupabaseStub({
			"rpc.accept_provider_service_request": {
				data: [
					requestRpcRow({
						request_status: "accepted",
						workroom_id: "workroom-1",
					}),
				],
			},
		});

		const result = await acceptServiceRequestForProvider(
			stub.client,
			PROVIDER_ID,
			"request-1",
		);

		expect(result.data).toEqual({
			id: REQUEST_ID,
			status: "accepted",
			conversation_id: CONVERSATION_ID,
			workroom_id: "workroom-1",
		});
		expect(stub.callsFor("rpc.accept_provider_service_request")[0]?.payload).toEqual({
			target_request_id: "request-1",
		});
	});

	it("rejects a pending request through the database function", async () => {
		const stub = createSupabaseStub({
			"rpc.reject_provider_service_request": {
				data: [requestRpcRow({ request_status: "rejected" })],
			},
		});

		const result = await rejectServiceRequestForProvider(
			stub.client,
			PROVIDER_ID,
			"request-1",
		);

		expect(result.data?.status).toBe("rejected");
	});

	it("cancels a pending request through the database function", async () => {
		const stub = createSupabaseStub({
			"rpc.cancel_provider_service_request": {
				data: [requestRpcRow({ request_status: "cancelled" })],
			},
		});

		const result = await cancelServiceRequestForClient(
			stub.client,
			CLIENT_ID,
			"request-1",
		);

		expect(result.data?.status).toBe("cancelled");
	});

	it("reports a failed decision when the database function returns no row", async () => {
		const stub = createSupabaseStub({
			"rpc.accept_provider_service_request": { data: [] },
		});

		const result = await acceptServiceRequestForProvider(
			stub.client,
			PROVIDER_ID,
			"request-1",
		);

		expect(result.error).toBe("Service request could not be accepted.");
	});
});
