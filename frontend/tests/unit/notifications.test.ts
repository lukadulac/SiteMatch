import { describe, expect, it } from "vitest";
import {
	getNotificationHref,
	getNotifications,
	getUnreadNotificationCount,
	markAllNotificationsRead,
	markNotificationRead,
	NOTIFICATION_LIST_LIMIT,
} from "@/lib/notifications/service";
import { createSupabaseStub } from "../helpers/supabase-stub";

describe("getUnreadNotificationCount", () => {
	it("counts the user's unread notifications without loading rows", async () => {
		const stub = createSupabaseStub({ "notifications.select": { count: 3 } });

		const result = await getUnreadNotificationCount(stub.client, "user-1");

		expect(result.data).toBe(3);
		expect(stub.callsFor("notifications.select")[0]?.filters).toEqual(
			expect.arrayContaining([
				{ method: "eq", args: ["user_id", "user-1"] },
				{ method: "is", args: ["read_at", null] },
			]),
		);
	});

	it("reports a failed count", async () => {
		const stub = createSupabaseStub({
			"notifications.select": { error: { message: "permission denied" } },
		});

		const result = await getUnreadNotificationCount(stub.client, "user-1");

		expect(result.error).toBe("permission denied");
	});
});

describe("getNotificationHref", () => {
	it("leads each kind of notification to its page", () => {
		expect(getNotificationHref({ entity_type: "project", entity_id: "p1" })).toBe("/oglasi/p1");
		expect(getNotificationHref({ entity_type: "application", entity_id: "a1" })).toBe(
			"/dashboard/provider/applications?status=closed",
		);
		expect(getNotificationHref({ entity_type: "service_request", entity_id: "r1" })).toBe(
			"/dashboard/service-requests/r1",
		);
		expect(getNotificationHref({ entity_type: "workroom", entity_id: "w1" })).toBe(
			"/dashboard/workrooms/w1",
		);
	});
});

describe("getNotifications", () => {
	it("loads the user's newest notifications first, capped", async () => {
		const stub = createSupabaseStub({ "notifications.select": { data: [] } });

		await getNotifications(stub.client, "user-1");

		expect(stub.callsFor("notifications.select")[0]?.filters).toEqual(
			expect.arrayContaining([
				{ method: "eq", args: ["user_id", "user-1"] },
				{ method: "order", args: ["created_at", { ascending: false }] },
				{ method: "limit", args: [NOTIFICATION_LIST_LIMIT] },
			]),
		);
	});
});

describe("markNotificationRead", () => {
	const unread = {
		id: "n1",
		type: "workroom_completed",
		entity_type: "workroom",
		entity_id: "w1",
		title: "Marko marked Salon completed",
		read_at: null,
		created_at: "2026-11-04T10:00:00.000Z",
	};

	it("marks an unread notification read and returns it", async () => {
		const stub = createSupabaseStub({
			"notifications.select": { data: unread },
			"notifications.update": { data: null },
		});

		const result = await markNotificationRead(stub.client, "user-1", "n1");

		expect(result.data?.entity_id).toBe("w1");
		const update = stub.callsFor("notifications.update")[0];
		expect(update?.payload).toEqual({ read_at: expect.any(String) });
		expect(update?.filters).toEqual(
			expect.arrayContaining([
				{ method: "eq", args: ["id", "n1"] },
				{ method: "eq", args: ["user_id", "user-1"] },
			]),
		);
	});

	it("does not write again for a notification already read", async () => {
		const stub = createSupabaseStub({
			"notifications.select": { data: { ...unread, read_at: "2026-11-04T11:00:00.000Z" } },
		});

		const result = await markNotificationRead(stub.client, "user-1", "n1");

		expect(result.data?.id).toBe("n1");
		expect(stub.callKeys()).not.toContain("notifications.update");
	});

	it("returns nothing for someone else's notification", async () => {
		const stub = createSupabaseStub({ "notifications.select": { data: null } });

		const result = await markNotificationRead(stub.client, "user-2", "n1");

		expect(result.data).toBeNull();
		expect(stub.callKeys()).not.toContain("notifications.update");
	});
});

describe("markAllNotificationsRead", () => {
	it("marks only the user's unread notifications", async () => {
		const stub = createSupabaseStub({ "notifications.update": { data: null } });

		await markAllNotificationsRead(stub.client, "user-1");

		expect(stub.callsFor("notifications.update")[0]?.filters).toEqual(
			expect.arrayContaining([
				{ method: "eq", args: ["user_id", "user-1"] },
				{ method: "is", args: ["read_at", null] },
			]),
		);
	});
});
