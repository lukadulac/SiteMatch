import { describe, expect, it } from "vitest";
import { getHeaderState } from "@/lib/navigation/header-state";
import { createSupabaseStub, type StubResponses } from "../helpers/supabase-stub";

const USER = {
	id: "user-1",
	email: "ana@example.com",
	email_confirmed_at: "2026-01-01T00:00:00.000Z",
	user_metadata: {},
};

function stubFor(responses: StubResponses, user: Record<string, unknown> | null = USER) {
	return createSupabaseStub(responses, { user });
}

describe("getHeaderState", () => {
	it("returns no user for guests and queries nothing", async () => {
		const stub = stubFor({}, null);

		expect(await getHeaderState(stub.client)).toEqual({ user: null });
		expect(stub.callKeys()).toEqual([]);
	});

	it("builds the client menu with the unread count", async () => {
		const stub = stubFor({
			"profiles.select": {
				data: { role: "client", full_name: "Ana Kovač", avatar_url: "user-1/photo.webp" },
			},
			"conversations.select": { data: [{ id: "c1" }, { id: "c2" }] },
			"messages.select": { data: [{ conversation_id: "c1" }, { conversation_id: "c1" }] },
		});

		const { user } = await getHeaderState(stub.client);

		expect(user).toMatchObject({
			role: "client",
			name: "Ana Kovač",
			avatarPath: "user-1/photo.webp",
			emailVerified: true,
			profileHref: "/dashboard/client/profile",
			cta: { href: "/oglasi/novi", label: "Post a project" },
			counts: { unreadMessages: 1, pendingServiceRequests: 0 },
		});
		expect(stub.callKeys()).not.toContain("provider_service_requests.select");
	});

	it("counts pending service requests for providers", async () => {
		const stub = stubFor({
			"profiles.select": { data: { role: "provider", full_name: "Marko Ilić" } },
			"conversations.select": { data: [] },
			"provider_service_requests.select": { count: 2 },
		});

		const { user } = await getHeaderState(stub.client);

		expect(user?.counts).toEqual({ unreadMessages: 0, pendingServiceRequests: 2 });
		expect(user?.cta?.href).toBe("/dashboard/provider/services/post");
	});

	it("hides a badge whose count query fails instead of failing the header", async () => {
		const stub = stubFor({
			"profiles.select": { data: { role: "provider", full_name: "Marko Ilić" } },
			"conversations.select": { error: { message: "boom" } },
			"provider_service_requests.select": { error: { message: "boom" } },
		});

		const { user } = await getHeaderState(stub.client);

		expect(user?.counts).toEqual({ unreadMessages: 0, pendingServiceRequests: 0 });
	});

	it("flags an unconfirmed email", async () => {
		const stub = stubFor(
			{ "profiles.select": { data: { role: "admin", full_name: "Jelena Petrović" } } },
			{ ...USER, email_confirmed_at: null },
		);

		const { user } = await getHeaderState(stub.client);

		expect(user).toMatchObject({
			emailVerified: false,
			profileHref: "/dashboard/admin",
			cta: { href: "/dashboard/admin" },
		});
		expect(stub.callKeys()).toEqual(["profiles.select"]);
	});

	it("falls back to the metadata role and the email name without a profile row", async () => {
		const stub = stubFor(
			{ "profiles.select": { data: null }, "conversations.select": { data: [] } },
			{ ...USER, user_metadata: { role: "client" } },
		);

		const { user } = await getHeaderState(stub.client);

		expect(user).toMatchObject({ role: "client", name: "ana", avatarPath: null });
	});

	it("keeps an account with an unknown role signed in without a workspace", async () => {
		const stub = stubFor({ "profiles.select": { data: { role: null, full_name: "Someone" } } });

		const { user } = await getHeaderState(stub.client);

		expect(user).toMatchObject({ role: null, cta: null, profileHref: "/dashboard" });
	});
});
