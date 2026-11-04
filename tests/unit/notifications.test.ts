import { describe, expect, it } from "vitest";
import { getUnreadNotificationCount } from "@/lib/notifications/service";
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
