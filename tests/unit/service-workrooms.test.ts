import { describe, expect, it } from "vitest";
import {
	completeWorkroomForProvider,
	getClientWorkroomPreview,
	getClientWorkroomsPage,
	getProviderWorkroomsPage,
	getWorkroomDetailForParticipant,
} from "@/lib/service-workrooms/service";
import { parseWorkroomListQuery } from "@/lib/service-workrooms/schemas";
import { createSupabaseStub } from "../helpers/supabase-stub";

const CLIENT_ID = "client-1";
const PROVIDER_ID = "provider-1";
const SERVICE_ID = "service-1";
const REQUEST_ID = "11111111-1111-4111-8111-111111111111";
const WORKROOM_ID = "22222222-2222-4222-8222-222222222222";
const CONVERSATION_ID = "33333333-3333-4333-8333-333333333333";

function workroomRow(overrides: Record<string, unknown> = {}) {
	return {
		id: WORKROOM_ID,
		service_request_id: REQUEST_ID,
		service_id: SERVICE_ID,
		client_id: CLIENT_ID,
		provider_id: PROVIDER_ID,
		status: "active",
		accepted_at: "2026-01-02T00:00:00.000Z",
		completed_at: null,
		created_at: "2026-01-02T00:00:00.000Z",
		updated_at: "2026-01-02T00:00:00.000Z",
		service: {
			id: SERVICE_ID,
			title: "Brand identity",
			status: "published",
			price_type: "fixed",
			starting_price: 1200,
			delivery_estimate: "7 days",
			service_type_text: "Branding",
			category_text: "Design",
		},
		service_request: {
			id: REQUEST_ID,
			status: "accepted",
			message: "We need this service for a launch next month.",
			created_at: "2026-01-01T00:00:00.000Z",
		},
		client: { id: CLIENT_ID, full_name: "Client", city: "Belgrade", country: "Serbia" },
		provider: {
			id: PROVIDER_ID,
			full_name: "Provider",
			city: "Lisbon",
			country: "Portugal",
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

describe("parseWorkroomListQuery", () => {
	it("normalizes valid status and page values", () => {
		expect(parseWorkroomListQuery({ status: "completed", page: "3" })).toEqual({
			status: "completed",
			page: 3,
			pageSize: 10,
			offset: 20,
			wasNormalized: false,
		});
	});

	it("falls back safely for invalid status and page values", () => {
		expect(parseWorkroomListQuery({ status: "pending", page: "0" })).toEqual({
			status: "all",
			page: 1,
			pageSize: 10,
			offset: 0,
			wasNormalized: true,
		});
	});

	it("marks explicit all as normalized so canonical URLs can omit it", () => {
		expect(parseWorkroomListQuery({ status: "all" })).toEqual({
			status: "all",
			page: 1,
			pageSize: 10,
			offset: 0,
			wasNormalized: true,
		});
	});
});

describe("workroom list queries", () => {
	it("returns a paginated client page with count, status filter, stable sort, and conversation id", async () => {
		const stub = createSupabaseStub({
			"service_workrooms.select": {
				data: [workroomRow()],
				count: 12,
			},
			"conversations.select": { data: [conversationRow()] },
		});

		const result = await getClientWorkroomsPage(stub.client, CLIENT_ID, {
			status: "active",
			page: 2,
			pageSize: 10,
			offset: 10,
			wasNormalized: false,
		});

		expect(result.data?.totalCount).toBe(12);
		expect(result.data?.totalPages).toBe(2);
		expect(result.data?.workrooms[0]?.conversation_id).toBe(CONVERSATION_ID);
		expect(stub.callsFor("service_workrooms.select")[0]?.filters).toEqual(
			expect.arrayContaining([
				{ method: "eq", args: ["client_id", CLIENT_ID] },
				{ method: "eq", args: ["status", "active"] },
				{ method: "order", args: ["accepted_at", { ascending: false }] },
				{ method: "order", args: ["id", { ascending: false }] },
				{ method: "range", args: [10, 19] },
			]),
		);
	});

	it("does not add a status filter for all workrooms", async () => {
		const stub = createSupabaseStub({
			"service_workrooms.select": { data: [], count: 0 },
			"conversations.select": { data: [] },
		});

		await getProviderWorkroomsPage(stub.client, PROVIDER_ID, {
			status: "all",
			page: 1,
			pageSize: 10,
			offset: 0,
			wasNormalized: false,
		});

		const filters = stub.callsFor("service_workrooms.select")[0]?.filters;

		expect(filters).toContainEqual({ method: "eq", args: ["provider_id", PROVIDER_ID] });
		expect(filters).not.toContainEqual({ method: "eq", args: ["status", "all"] });
	});

	it("returns page metadata when the requested provider page is out of range", async () => {
		const stub = createSupabaseStub({
			"service_workrooms.select": [
				{
					error: { message: "Requested range not satisfiable" },
				},
				{
					data: null,
					count: 11,
				},
			],
		});

		const result = await getProviderWorkroomsPage(stub.client, PROVIDER_ID, {
			status: "all",
			page: 99,
			pageSize: 10,
			offset: 980,
			wasNormalized: false,
		});

		expect(result.data).toMatchObject({
			workrooms: [],
			totalCount: 11,
			totalPages: 2,
			page: 99,
		});
		expect(stub.callsFor("service_workrooms.select")[1]?.filters).toEqual(
			expect.arrayContaining([
				{ method: "eq", args: ["provider_id", PROVIDER_ID] },
			]),
		);
	});

	it("loads only three rows for the client dashboard preview", async () => {
		const stub = createSupabaseStub({
			"service_workrooms.select": {
				data: [workroomRow()],
				count: 4,
			},
			"conversations.select": { data: [conversationRow()] },
		});

		await getClientWorkroomPreview(stub.client, CLIENT_ID);

		expect(stub.callsFor("service_workrooms.select")[0]?.filters).toContainEqual({
			method: "range",
			args: [0, 2],
		});
	});
});

describe("getWorkroomDetailForParticipant", () => {
	it("returns the detail when the user is a workroom participant", async () => {
		const stub = createSupabaseStub({
			"service_workrooms.select": { data: workroomRow() },
			"conversations.select": { data: [conversationRow()] },
		});

		const result = await getWorkroomDetailForParticipant(
			stub.client,
			CLIENT_ID,
			WORKROOM_ID,
		);

		expect(result.data?.id).toBe(WORKROOM_ID);
		expect(result.data?.conversation_id).toBe(CONVERSATION_ID);
		expect(stub.callsFor("service_workrooms.select")[0]?.filters).toEqual(
			expect.arrayContaining([
				{ method: "eq", args: ["id", WORKROOM_ID] },
				{
					method: "or",
					args: [`client_id.eq.${CLIENT_ID},provider_id.eq.${CLIENT_ID}`],
				},
			]),
		);
	});

	it("returns null for nonexistent or unauthorized workrooms without loading conversations", async () => {
		const stub = createSupabaseStub({
			"service_workrooms.select": { data: null },
		});

		const result = await getWorkroomDetailForParticipant(
			stub.client,
			"outsider-1",
			WORKROOM_ID,
		);

		expect(result.data).toBeNull();
		expect(stub.callKeys()).not.toContain("conversations.select");
	});
});

describe("completeWorkroomForProvider", () => {
	it("completes an active workroom through the database function", async () => {
		const stub = createSupabaseStub({
			"rpc.complete_service_workroom": {
				data: [{ workroom_id: WORKROOM_ID, workroom_status: "completed" }],
			},
		});

		const result = await completeWorkroomForProvider(
			stub.client,
			PROVIDER_ID,
			WORKROOM_ID,
		);

		expect(result.data).toEqual({
			id: WORKROOM_ID,
			status: "completed",
		});
		expect(stub.callsFor("rpc.complete_service_workroom")[0]?.payload).toEqual({
			target_workroom_id: WORKROOM_ID,
		});
	});

	it("reports a failed completion when the database function returns no row", async () => {
		const stub = createSupabaseStub({
			"rpc.complete_service_workroom": { data: [] },
		});

		const result = await completeWorkroomForProvider(
			stub.client,
			PROVIDER_ID,
			WORKROOM_ID,
		);

		expect(result.error).toBe("Workroom could not be completed.");
	});
});
