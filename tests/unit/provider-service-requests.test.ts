import { describe, expect, it } from "vitest";
import {
	acceptServiceRequestForProvider,
	cancelServiceRequestForClient,
	createServiceRequest,
	rejectServiceRequestForProvider,
} from "@/lib/provider-service-requests/service";
import { createSupabaseStub } from "../helpers/supabase-stub";

const CLIENT_ID = "client-1";
const PROVIDER_ID = "provider-1";
const SERVICE_ID = "service-1";

const CLIENT_ROLE = { data: { role: "client" } };
const PROVIDER_ROLE = { data: { role: "provider" } };

function requestRpcRow(overrides: Record<string, unknown> = {}) {
	return {
		request_id: "request-1",
		request_status: "pending",
		conversation_id: "conversation-1",
		...overrides,
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
			id: "request-1",
			status: "pending",
			conversation_id: "conversation-1",
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

describe("provider service request decisions", () => {
	it("accepts a pending request through the database function", async () => {
		const stub = createSupabaseStub({
			"rpc.accept_provider_service_request": {
				data: [requestRpcRow({ request_status: "accepted" })],
			},
		});

		const result = await acceptServiceRequestForProvider(
			stub.client,
			PROVIDER_ID,
			"request-1",
		);

		expect(result.data).toEqual({
			id: "request-1",
			status: "accepted",
			conversation_id: "conversation-1",
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
