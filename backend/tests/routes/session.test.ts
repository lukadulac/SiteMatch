import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { INTERNAL_SECRET } from "../helpers/request-client-mock.js";
import { createSupabaseStub, stubUser, type StubResponses, type SupabaseStub } from "../helpers/supabase-stub.js";

const supabase = vi.hoisted(() => ({ stub: null as SupabaseStub | null }));
vi.mock("../../src/lib/supabase/request-client.js", async () => {
	const { requestClientMock } = await import("../helpers/request-client-mock.js");
	return requestClientMock(supabase);
});

const { default: app } = await import("../../src/app.js");

function arrange(user: { id: string; user_metadata?: Record<string, unknown> } | null, responses: StubResponses = {}) {
	supabase.stub = createSupabaseStub(responses, { user: user ? stubUser(user) : null });
	return supabase.stub;
}

beforeEach(() => {
	supabase.stub = null;
});

describe("GET /api/session", () => {
	const get = () => request(app).get("/api/session").set("x-internal-secret", INTERNAL_SECRET);

	it("is only for the frontend's server", async () => {
		arrange(null);

		const response = await request(app).get("/api/session");

		expect(response.status).toBe(403);
	});

	it("returns null for a signed-out visitor", async () => {
		arrange(null);

		const response = await get();

		expect(response.status).toBe(200);
		expect(response.body).toEqual({ data: null });
	});

	it("reports the session cookie name it reads, for the proxy to compare", async () => {
		arrange(null);

		const response = await get();

		// From SUPABASE_URL in vitest.config.ts.
		expect(response.headers["x-auth-cookie"]).toBe("sb-testproject-auth-token");
	});

	it("returns the role of an enabled account", async () => {
		const stub = arrange({ id: "client-1" }, {
			"profiles.select": { data: { role: "client" } },
			"rpc.is_account_enabled": { data: true },
		});

		const response = await get();

		expect(response.body).toEqual({ data: { user: { id: "client-1" }, role: "client" } });
		expect(stub.callKeys()).not.toContain("auth.signOut");
	});

	it("returns no role for a user without a profile row, and keeps them signed in", async () => {
		const stub = arrange({ id: "ghost-1" }, { "profiles.select": { data: null } });

		const response = await get();

		expect(response.body).toEqual({ data: { user: { id: "ghost-1" }, role: null } });
		expect(stub.callKeys()).not.toContain("auth.signOut");
		expect(stub.callKeys()).not.toContain("rpc.is_account_enabled");
	});

	it("returns no role for a role that is not an app role", async () => {
		arrange({ id: "legacy-1" }, { "profiles.select": { data: { role: "superuser" } } });

		const response = await get();

		expect(response.body).toEqual({ data: { user: { id: "legacy-1" }, role: null } });
	});

	it("signs a disabled account out locally and returns null", async () => {
		const stub = arrange({ id: "blocked-provider" }, {
			"profiles.select": { data: { role: "provider" } },
			"rpc.is_account_enabled": { data: false },
		});

		const response = await get();

		expect(response.body).toEqual({ data: null });
		expect(stub.callsFor("auth.signOut")).toEqual([expect.objectContaining({ payload: { scope: "local" } })]);
	});

	it("treats a failed enabled check as disabled", async () => {
		const stub = arrange({ id: "provider-1" }, {
			"profiles.select": { data: { role: "provider" } },
			"rpc.is_account_enabled": { data: null, error: { message: "boom" } },
		});

		const response = await get();

		expect(response.body).toEqual({ data: null });
		expect(stub.callKeys()).toContain("auth.signOut");
	});
});

describe("POST /api/session/bootstrap", () => {
	const post = () => request(app).post("/api/session/bootstrap").set("x-internal-secret", INTERNAL_SECRET);

	it("is only for the frontend's server", async () => {
		arrange({ id: "client-1" });

		const response = await request(app).post("/api/session/bootstrap").set("Origin", "http://localhost:3000");

		expect(response.status).toBe(403);
	});

	it("rejects a signed-out visitor", async () => {
		arrange(null);

		const response = await post();

		expect(response.status).toBe(401);
		expect(response.body).toEqual({ error: "Unauthorized." });
	});

	it("returns the role of an existing profile", async () => {
		const stub = arrange({ id: "provider-1" }, { "profiles.select": { data: { role: "provider" } } });

		const response = await post();

		expect(response.body).toEqual({ data: { role: "provider" } });
		expect(stub.callKeys()).not.toContain("profiles.upsert");
	});

	it("provisions a new profile from the sign-up metadata", async () => {
		const stub = arrange(
			{ id: "client-1", user_metadata: { role: "client", full_name: "Ana" } },
			{
				"profiles.select": { data: null },
				"storage.avatars.list": { data: [] },
				"profiles.upsert": { data: null },
				"client_profiles.upsert": { data: null },
			},
		);

		const response = await post();

		expect(response.body).toEqual({ data: { role: "client" } });
		expect(stub.callKeys()).toEqual(expect.arrayContaining(["profiles.upsert", "client_profiles.upsert"]));
	});

	it("signs out and rejects an account that cannot be provisioned", async () => {
		const stub = arrange({ id: "ghost-1", user_metadata: {} }, { "profiles.select": { data: null } });

		const response = await post();

		expect(response.status).toBe(401);
		expect(stub.callsFor("auth.signOut")).toEqual([expect.objectContaining({ payload: undefined })]);
	});
});

describe("GET /api/me/header", () => {
	it("is only for the frontend's server", async () => {
		arrange(null);

		const response = await request(app).get("/api/me/header");

		expect(response.status).toBe(403);
	});

	it("returns no user for a signed-out visitor", async () => {
		arrange(null);

		const response = await request(app).get("/api/me/header").set("x-internal-secret", INTERNAL_SECRET);

		expect(response.body).toEqual({ data: { user: null } });
	});

	it("returns the header state of a signed-in admin", async () => {
		arrange({ id: "admin-1" }, { "profiles.select": { data: { role: "admin", full_name: "Mia", avatar_url: null } } });

		const response = await request(app).get("/api/me/header").set("x-internal-secret", INTERNAL_SECRET);

		expect(response.body.data.user).toMatchObject({
			role: "admin",
			name: "Mia",
			dashboardHref: "/dashboard/admin",
			counts: { unreadMessages: 0, unreadNotifications: 0, pendingServiceRequests: 0 },
		});
	});
});
