import { describe, expect, it } from "vitest";
import { createServiceRequest } from "@/lib/provider-service-requests/service";
import { createSupabaseStub } from "../helpers/supabase-stub";

const CLIENT_ID = "client-1";
const PROVIDER_ID = "provider-1";
const SERVICE_ID = "service-1";

const CLIENT_ROLE = { data: { role: "client" } };
const PROVIDER_ROLE = { data: { role: "provider" } };

function serviceRow(overrides: Record<string, unknown> = {}) {
	return {
		id: SERVICE_ID,
		provider_id: PROVIDER_ID,
		status: "published",
		...overrides,
	};
}

function requestRow(overrides: Record<string, unknown> = {}) {
	return {
		id: "request-1",
		service_id: SERVICE_ID,
		client_id: CLIENT_ID,
		provider_id: PROVIDER_ID,
		status: "pending",
		message: "We need this service for a launch next month.",
		created_at: "2026-09-15T10:00:00.000Z",
		updated_at: "2026-09-15T10:00:00.000Z",
		...overrides,
	};
}

describe("createServiceRequest", () => {
	it("creates a pending request for a published service as the authenticated client", async () => {
		const stub = createSupabaseStub({
			"profiles.select": CLIENT_ROLE,
			"provider_service_listings.select": { data: serviceRow() },
			"provider_service_requests.insert": { data: requestRow() },
		});

		const result = await createServiceRequest(stub.client, CLIENT_ID, SERVICE_ID, {
			message: "We need this service for a launch next month.",
		});

		expect(result.data).toEqual(requestRow());
		expect(stub.callsFor("provider_service_requests.insert")[0]?.payload).toEqual({
			service_id: SERVICE_ID,
			client_id: CLIENT_ID,
			provider_id: PROVIDER_ID,
			message: "We need this service for a launch next month.",
			status: "pending",
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
		expect(stub.callKeys()).not.toContain("provider_service_requests.insert");
	});

	it("rejects a missing marketplace profile", async () => {
		const stub = createSupabaseStub({
			"profiles.select": { data: null },
		});

		const result = await createServiceRequest(stub.client, CLIENT_ID, SERVICE_ID, {
			message: "I want to request this.",
		});

		expect(result.error).toBe("Your marketplace profile could not be found.");
		expect(stub.callKeys()).not.toContain("provider_service_requests.insert");
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
		expect(stub.callKeys()).not.toContain("provider_service_requests.insert");
	});

	it("rejects draft or paused services", async () => {
		const stub = createSupabaseStub({
			"profiles.select": CLIENT_ROLE,
			"provider_service_listings.select": {
				data: serviceRow({ status: "draft" }),
			},
		});

		const result = await createServiceRequest(stub.client, CLIENT_ID, SERVICE_ID, {
			message: "We need this service for a launch next month.",
		});

		expect(result.error).toBe("Service is not available for requests.");
		expect(stub.callKeys()).not.toContain("provider_service_requests.insert");
	});

	it("rejects nonexistent services", async () => {
		const stub = createSupabaseStub({
			"profiles.select": CLIENT_ROLE,
			"provider_service_listings.select": { data: null },
		});

		const result = await createServiceRequest(stub.client, CLIENT_ID, SERVICE_ID, {
			message: "We need this service for a launch next month.",
		});

		expect(result.error).toBe("Service is not available for requests.");
		expect(stub.callKeys()).not.toContain("provider_service_requests.insert");
	});

	it("rejects the service owner", async () => {
		const stub = createSupabaseStub({
			"profiles.select": CLIENT_ROLE,
			"provider_service_listings.select": {
				data: serviceRow({ provider_id: CLIENT_ID }),
			},
		});

		const result = await createServiceRequest(stub.client, CLIENT_ID, SERVICE_ID, {
			message: "We need this service for a launch next month.",
		});

		expect(result.error).toBe("You cannot request your own service.");
		expect(stub.callKeys()).not.toContain("provider_service_requests.insert");
	});

	it("maps an active duplicate request constraint violation to a friendly error", async () => {
		const stub = createSupabaseStub({
			"profiles.select": CLIENT_ROLE,
			"provider_service_listings.select": { data: serviceRow() },
			"provider_service_requests.insert": {
				error: { message: "duplicate key value", code: "23505" },
			},
		});

		const result = await createServiceRequest(stub.client, CLIENT_ID, SERVICE_ID, {
			message: "We need this service for a launch next month.",
		});

		expect(result.error).toBe(
			"You already have an active request for this service.",
		);
	});

	it("derives the provider from the service instead of trusting caller input", async () => {
		const stub = createSupabaseStub({
			"profiles.select": CLIENT_ROLE,
			"provider_service_listings.select": { data: serviceRow() },
			"provider_service_requests.insert": { data: requestRow() },
		});

		await createServiceRequest(stub.client, CLIENT_ID, SERVICE_ID, {
			message: "We need this service for a launch next month.",
			provider_id: "attacker-provider",
		} as never);

		expect(stub.callsFor("provider_service_requests.insert")[0]?.payload).toMatchObject({
			client_id: CLIENT_ID,
			provider_id: PROVIDER_ID,
			service_id: SERVICE_ID,
		});
	});
});
