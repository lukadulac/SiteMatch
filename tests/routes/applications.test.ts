import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PATCH } from "@/app/api/applications/[id]/route";
import { GET as GET_PROJECT_APPLICATIONS } from "@/app/api/projects/[id]/applications/route";
import { GET as GET_MY_PROJECTS } from "@/app/api/projects/mine/route";
import {
	getClientProjects,
	getProjectApplicationForClient,
	getProjectApplicationsForClient,
	updateProjectApplicationStatusForClient,
} from "@/lib/projects/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseStub, stubUser } from "../helpers/supabase-stub";

vi.mock("@/lib/supabase/server", () => ({
	createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/projects/service", () => ({
	getClientProjects: vi.fn(),
	getProjectApplicationForClient: vi.fn(),
	getProjectApplicationsForClient: vi.fn(),
	updateProjectApplicationStatusForClient: vi.fn(),
}));

const APPLICATION_ID = "application-1";
const PROJECT_ID = "project-1";
const applicationContext = { params: Promise.resolve({ id: APPLICATION_ID }) };
const projectContext = { params: Promise.resolve({ id: PROJECT_ID }) };

function signIn(userId: string | null) {
	const stub = createSupabaseStub(
		{},
		{ user: userId ? stubUser({ id: userId }) : null },
	);

	vi.mocked(createSupabaseServerClient).mockResolvedValue(stub.client);

	return stub;
}

function patchRequest(body: unknown) {
	return new Request(`http://localhost/api/applications/${APPLICATION_ID}`, {
		method: "PATCH",
		body: typeof body === "string" ? body : JSON.stringify(body),
	});
}

beforeEach(() => {
	signIn("client-1");
});

describe("GET /api/applications/[id]", () => {
	it("rejects an anonymous request", async () => {
		signIn(null);

		const response = await GET(new Request("http://localhost"), applicationContext);

		expect(response.status).toBe(401);
		expect(getProjectApplicationForClient).not.toHaveBeenCalled();
	});

	it("returns the application", async () => {
		vi.mocked(getProjectApplicationForClient).mockResolvedValue({
			data: { id: APPLICATION_ID },
		} as never);

		const response = await GET(new Request("http://localhost"), applicationContext);

		expect(response.status).toBe(200);
		expect((await response.json()).data.id).toBe(APPLICATION_ID);
	});

	it("maps service refusals to the right status codes", async () => {
		const cases = [
			{ error: "Only clients can access this resource.", status: 403 },
			{ error: "Application not found.", status: 404 },
			{ error: "connection lost", status: 400 },
		];

		for (const { error, status } of cases) {
			vi.mocked(getProjectApplicationForClient).mockResolvedValue({ error });

			const response = await GET(new Request("http://localhost"), applicationContext);

			expect(response.status, error).toBe(status);
		}
	});
});

describe("PATCH /api/applications/[id]", () => {
	it("rejects an anonymous request before parsing the body", async () => {
		signIn(null);

		const response = await PATCH(
			patchRequest({ status: "accepted" }),
			applicationContext,
		);

		expect(response.status).toBe(401);
		expect(updateProjectApplicationStatusForClient).not.toHaveBeenCalled();
	});

	it("rejects a body that is not JSON", async () => {
		const response = await PATCH(patchRequest("not json"), applicationContext);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: "Request body must be valid JSON.",
		});
	});

	it("rejects a status the client may not set", async () => {
		for (const status of ["pending", "viewed", "withdrawn", "deleted"]) {
			const response = await PATCH(patchRequest({ status }), applicationContext);
			const body = await response.json();

			expect(response.status, status).toBe(400);
			expect(body.fieldErrors).toHaveProperty("status");
		}

		expect(updateProjectApplicationStatusForClient).not.toHaveBeenCalled();
	});

	it("applies an allowed status change", async () => {
		vi.mocked(updateProjectApplicationStatusForClient).mockResolvedValue({
			data: { id: APPLICATION_ID, status: "accepted" },
		});

		const response = await PATCH(
			patchRequest({ status: "accepted" }),
			applicationContext,
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.data).toEqual({ id: APPLICATION_ID, status: "accepted" });
		expect(body.message).toBeTruthy();
	});

	it("maps service refusals to the right status codes", async () => {
		const cases = [
			{ error: "Only clients can access this resource.", status: 403 },
			{ error: "Application not found.", status: 404 },
			{ error: "This application can no longer be updated.", status: 409 },
			{ error: "connection lost", status: 400 },
		];

		for (const { error, status } of cases) {
			vi.mocked(updateProjectApplicationStatusForClient).mockResolvedValue({ error });

			const response = await PATCH(
				patchRequest({ status: "accepted" }),
				applicationContext,
			);

			expect(response.status, error).toBe(status);
		}
	});
});

describe("GET /api/projects/[id]/applications", () => {
	it("rejects an anonymous request", async () => {
		signIn(null);

		const response = await GET_PROJECT_APPLICATIONS(
			new Request("http://localhost"),
			projectContext,
		);

		expect(response.status).toBe(401);
		expect(getProjectApplicationsForClient).not.toHaveBeenCalled();
	});

	it("returns the applications for the listing", async () => {
		vi.mocked(getProjectApplicationsForClient).mockResolvedValue({
			data: [{ id: APPLICATION_ID }],
		} as never);

		const response = await GET_PROJECT_APPLICATIONS(
			new Request("http://localhost"),
			projectContext,
		);

		expect(response.status).toBe(200);
		expect((await response.json()).data).toHaveLength(1);
	});

	it("maps service refusals to the right status codes", async () => {
		const cases = [
			{ error: "Only clients can access this resource.", status: 403 },
			{ error: "Project not found.", status: 404 },
			{ error: "connection lost", status: 400 },
		];

		for (const { error, status } of cases) {
			vi.mocked(getProjectApplicationsForClient).mockResolvedValue({ error });

			const response = await GET_PROJECT_APPLICATIONS(
				new Request("http://localhost"),
				projectContext,
			);

			expect(response.status, error).toBe(status);
		}
	});
});

describe("GET /api/projects/mine", () => {
	it("rejects an anonymous request", async () => {
		signIn(null);

		expect((await GET_MY_PROJECTS()).status).toBe(401);
		expect(getClientProjects).not.toHaveBeenCalled();
	});

	it("returns the client's own listings", async () => {
		vi.mocked(getClientProjects).mockResolvedValue({
			data: [{ id: PROJECT_ID }],
		} as never);

		const response = await GET_MY_PROJECTS();

		expect(response.status).toBe(200);
		expect((await response.json()).data).toHaveLength(1);
	});

	it("answers 403 when the caller is not a client", async () => {
		vi.mocked(getClientProjects).mockResolvedValue({
			error: "Only clients can view their project listings.",
		});

		expect((await GET_MY_PROJECTS()).status).toBe(403);
	});
});
