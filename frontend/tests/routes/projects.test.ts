import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/projects/route";
import {
	createProject,
	getPublishedProjectsForProviders,
} from "@/lib/projects/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseStub, stubUser } from "../helpers/supabase-stub";

vi.mock("@/lib/supabase/server", () => ({
	createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/projects/service", () => ({
	createProject: vi.fn(),
	getPublishedProjectsForProviders: vi.fn(),
}));

const UUID = "11111111-1111-4111-8111-111111111111";

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

function signIn(userId: string | null) {
	const stub = createSupabaseStub(
		{},
		{ user: userId ? stubUser({ id: userId }) : null },
	);

	vi.mocked(createSupabaseServerClient).mockResolvedValue(stub.client);

	return stub;
}

function postRequest(body: unknown) {
	return new Request("http://localhost/api/projects", {
		method: "POST",
		body: typeof body === "string" ? body : JSON.stringify(body),
	});
}

beforeEach(() => {
	signIn("client-1");
});

describe("GET /api/projects", () => {
	it("rejects an anonymous request", async () => {
		signIn(null);

		const response = await GET();

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: "Unauthorized." });
		expect(getPublishedProjectsForProviders).not.toHaveBeenCalled();
	});

	it("returns the listing feed", async () => {
		vi.mocked(getPublishedProjectsForProviders).mockResolvedValue({
			data: [{ id: "project-1" }],
		} as never);

		const response = await GET();

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ data: [{ id: "project-1" }] });
	});

	it("answers 403 when the caller is not a provider", async () => {
		vi.mocked(getPublishedProjectsForProviders).mockResolvedValue({
			error: "Only providers can access this resource.",
		});

		expect((await GET()).status).toBe(403);
	});

	it("answers 400 for any other failure", async () => {
		vi.mocked(getPublishedProjectsForProviders).mockResolvedValue({
			error: "connection lost",
		});

		expect((await GET()).status).toBe(400);
	});
});

describe("POST /api/projects", () => {
	it("rejects an anonymous request before parsing the body", async () => {
		signIn(null);

		const response = await POST(postRequest(validListingBody()));

		expect(response.status).toBe(401);
		expect(createProject).not.toHaveBeenCalled();
	});

	it("rejects a body that is not JSON", async () => {
		const response = await POST(postRequest("not json"));

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: "Request body must be valid JSON.",
		});
		expect(createProject).not.toHaveBeenCalled();
	});

	it("reports validation failures per field", async () => {
		const response = await POST(
			postRequest({ ...validListingBody(), title: "Hi" }),
		);
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.error).toBe("Validation failed.");
		expect(body.fieldErrors).toHaveProperty("title");
		expect(createProject).not.toHaveBeenCalled();
	});

	it("creates the listing and answers 201", async () => {
		vi.mocked(createProject).mockResolvedValue({
			data: { id: "project-1", slug: "landing-page-abc", status: "draft" },
		});

		const response = await POST(postRequest(validListingBody()));
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(body.data).toEqual({
			id: "project-1",
			slug: "landing-page-abc",
			status: "draft",
		});
		expect(body.message).toBeTruthy();
	});

	it("passes the signed-in user and the parsed payload to the service", async () => {
		vi.mocked(createProject).mockResolvedValue({
			data: { id: "project-1", slug: "x", status: "draft" },
		});

		await POST(postRequest(validListingBody()));

		const [, userId, input] = vi.mocked(createProject).mock.calls[0] ?? [];

		expect(userId).toBe("client-1");
		expect(input).toMatchObject({ title: "Landing page redesign", status: "draft" });
	});

	it("maps service refusals to the right status codes", async () => {
		const cases = [
			{ error: "Only clients can manage project listings.", status: 403 },
			{
				error: "Complete your client profile before managing listings.",
				status: 409,
			},
			{ error: "connection lost", status: 400 },
		];

		for (const { error, status } of cases) {
			vi.mocked(createProject).mockResolvedValue({ error });

			const response = await POST(postRequest(validListingBody()));

			expect(response.status, error).toBe(status);
			expect(await response.json()).toEqual({ error });
		}
	});
});
