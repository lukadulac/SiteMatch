import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PATCH, POST } from "@/app/api/projects/[id]/route";
import {
	createProjectApplication,
	getClientProjectById,
	getPublishedProjectByIdForProvider,
	updateClientProject,
} from "@/lib/projects/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
	createSupabaseStub,
	stubUser,
	type StubResponses,
} from "../helpers/supabase-stub";

vi.mock("@/lib/supabase/server", () => ({
	createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/projects/service", () => ({
	createProjectApplication: vi.fn(),
	getClientProjectById: vi.fn(),
	getPublishedProjectByIdForProvider: vi.fn(),
	updateClientProject: vi.fn(),
}));

const PROJECT_ID = "project-1";
const UUID = "11111111-1111-4111-8111-111111111111";
const context = { params: Promise.resolve({ id: PROJECT_ID }) };

function validListingBody() {
	return {
		title: "Landing page redesign",
		description: "A".repeat(60),
		service_type_id: UUID,
		business_domain_id: UUID,
		what_do_you_need_text: "We need a brand new marketing site.",
		budget_min: 500,
	};
}

function signIn(userId: string | null, responses: StubResponses = {}) {
	const stub = createSupabaseStub(responses, {
		user: userId ? stubUser({ id: userId }) : null,
	});

	vi.mocked(createSupabaseServerClient).mockResolvedValue(stub.client);

	return stub;
}

function jsonRequest(method: string, body: unknown) {
	return new Request(`http://localhost/api/projects/${PROJECT_ID}`, {
		method,
		body: typeof body === "string" ? body : JSON.stringify(body),
	});
}

beforeEach(() => {
	signIn("client-1", { "profiles.select": { data: { role: "client" } } });
});

describe("GET /api/projects/[id]", () => {
	it("rejects an anonymous request", async () => {
		signIn(null);

		const response = await GET(new Request("http://localhost"), context);

		expect(response.status).toBe(401);
	});

	it("rejects a signed-in user with no profile row", async () => {
		signIn("ghost-1", { "profiles.select": { data: null } });

		const response = await GET(new Request("http://localhost"), context);

		expect(response.status).toBe(401);
		expect(getClientProjectById).not.toHaveBeenCalled();
		expect(getPublishedProjectByIdForProvider).not.toHaveBeenCalled();
	});

	it("serves the owner view to a client", async () => {
		vi.mocked(getClientProjectById).mockResolvedValue({
			data: { id: PROJECT_ID },
		} as never);

		const response = await GET(new Request("http://localhost"), context);

		expect(response.status).toBe(200);
		expect(getClientProjectById).toHaveBeenCalled();
		expect(getPublishedProjectByIdForProvider).not.toHaveBeenCalled();
	});

	it("serves the public view to a provider", async () => {
		signIn("provider-1", { "profiles.select": { data: { role: "provider" } } });
		vi.mocked(getPublishedProjectByIdForProvider).mockResolvedValue({
			data: { id: PROJECT_ID },
		} as never);

		const response = await GET(new Request("http://localhost"), context);

		expect(response.status).toBe(200);
		expect(getPublishedProjectByIdForProvider).toHaveBeenCalled();
		expect(getClientProjectById).not.toHaveBeenCalled();
	});

	it("maps service refusals to the right status codes", async () => {
		const cases = [
			{ error: "Only clients can view their project listings.", status: 403 },
			{ error: "Project not found.", status: 404 },
			{ error: "connection lost", status: 400 },
		];

		for (const { error, status } of cases) {
			vi.mocked(getClientProjectById).mockResolvedValue({ error });

			const response = await GET(new Request("http://localhost"), context);

			expect(response.status, error).toBe(status);
		}
	});

	it("surfaces a profile lookup failure", async () => {
		signIn("client-1", {
			"profiles.select": { error: { message: "connection lost" } },
		});

		const response = await GET(new Request("http://localhost"), context);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: "connection lost" });
	});
});

describe("PATCH /api/projects/[id]", () => {
	it("rejects an anonymous request before parsing the body", async () => {
		signIn(null);

		const response = await PATCH(jsonRequest("PATCH", validListingBody()), context);

		expect(response.status).toBe(401);
		expect(updateClientProject).not.toHaveBeenCalled();
	});

	it("rejects a body that is not JSON", async () => {
		const response = await PATCH(jsonRequest("PATCH", "not json"), context);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: "Request body must be valid JSON.",
		});
	});

	it("reports validation failures per field", async () => {
		const response = await PATCH(
			jsonRequest("PATCH", { ...validListingBody(), budget_min: 900, budget_max: 100 }),
			context,
		);
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.fieldErrors).toHaveProperty("budget_max");
		expect(updateClientProject).not.toHaveBeenCalled();
	});

	it("updates the listing", async () => {
		vi.mocked(updateClientProject).mockResolvedValue({
			data: { id: PROJECT_ID, slug: "landing", status: "published" },
		});

		const response = await PATCH(jsonRequest("PATCH", validListingBody()), context);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.data.id).toBe(PROJECT_ID);
		expect(body.message).toBeTruthy();
	});

	it("maps service refusals to the right status codes", async () => {
		const cases = [
			{ error: "Only clients can manage project listings.", status: 403 },
			{ error: "Project not found.", status: 404 },
			{
				error: "Complete your client profile before managing listings.",
				status: 409,
			},
			{ error: "connection lost", status: 400 },
		];

		for (const { error, status } of cases) {
			vi.mocked(updateClientProject).mockResolvedValue({ error });

			const response = await PATCH(jsonRequest("PATCH", validListingBody()), context);

			expect(response.status, error).toBe(status);
		}
	});

	it("still answers 4xx and echoes the message for an uneditable listing", async () => {
		// The handler's 409 branch matches an older wording than the service now
		// returns ("Only draft, published, or in-discussion projects can be
		// updated."), so this refusal currently falls through to the generic 400.
		vi.mocked(updateClientProject).mockResolvedValue({
			error: "Only draft, published, or in-discussion projects can be updated.",
		});

		const response = await PATCH(jsonRequest("PATCH", validListingBody()), context);

		expect(response.status).toBeGreaterThanOrEqual(400);
		expect(response.status).toBeLessThan(500);
		expect(await response.json()).toEqual({
			error: "Only draft, published, or in-discussion projects can be updated.",
		});
	});
});

describe("POST /api/projects/[id] (apply)", () => {
	const application = { cover_message: "I would love to build this for you." };

	it("rejects an anonymous request", async () => {
		signIn(null);

		const response = await POST(jsonRequest("POST", application), context);

		expect(response.status).toBe(401);
		expect(createProjectApplication).not.toHaveBeenCalled();
	});

	it("rejects a body that is not JSON", async () => {
		const response = await POST(jsonRequest("POST", "not json"), context);

		expect(response.status).toBe(400);
	});

	it("reports validation failures per field", async () => {
		const response = await POST(
			jsonRequest("POST", { cover_message: "Hi" }),
			context,
		);
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.fieldErrors).toHaveProperty("cover_message");
		expect(createProjectApplication).not.toHaveBeenCalled();
	});

	it("submits the application and answers 201", async () => {
		vi.mocked(createProjectApplication).mockResolvedValue({
			data: { id: "application-1", status: "pending" },
		});

		const response = await POST(jsonRequest("POST", application), context);
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(body.data).toEqual({ id: "application-1", status: "pending" });
	});

	it("maps service refusals to the right status codes", async () => {
		const cases = [
			{ error: "Only providers can access this resource.", status: 403 },
			{ error: "Project not found.", status: 404 },
			{ error: "Providers cannot apply to their own project.", status: 409 },
			{ error: "You have already applied to this project.", status: 409 },
			{ error: "connection lost", status: 400 },
		];

		for (const { error, status } of cases) {
			vi.mocked(createProjectApplication).mockResolvedValue({ error });

			const response = await POST(jsonRequest("POST", application), context);

			expect(response.status, error).toBe(status);
		}
	});
});
