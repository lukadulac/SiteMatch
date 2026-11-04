import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	markAllNotificationsReadAction,
	openNotificationAction,
} from "@/app/dashboard/notification-actions";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/notifications/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { expectRedirect, expectRedirectTo } from "../helpers/redirect";
import { createSupabaseStub, stubUser } from "../helpers/supabase-stub";

vi.mock("next/navigation", () => ({
	redirect: (path: string) => {
		throw new Error(`NEXT_REDIRECT:${path}`);
	},
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
	createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/notifications/service", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/notifications/service")>()),
	markNotificationRead: vi.fn(),
	markAllNotificationsRead: vi.fn(),
}));

function signIn(userId: string | null) {
	const stub = createSupabaseStub({}, { user: userId ? stubUser({ id: userId }) : null });

	vi.mocked(createSupabaseServerClient).mockResolvedValue(stub.client);
}

beforeEach(() => {
	vi.clearAllMocks();
	signIn("user-1");
});

describe("openNotificationAction", () => {
	it("sends a signed-out visitor to the login page", async () => {
		signIn(null);

		expect(await expectRedirect(openNotificationAction("n1"))).toBe("/login");
		expect(markNotificationRead).not.toHaveBeenCalled();
	});

	it("marks the notification read and opens what it points at", async () => {
		vi.mocked(markNotificationRead).mockResolvedValue({
			data: {
				id: "n1",
				type: "application_accepted",
				entity_type: "workroom",
				entity_id: "w1",
				title: "Ana hired you for Salon booking site",
				read_at: null,
				created_at: "2026-11-04T10:00:00.000Z",
			},
		});

		expect(await expectRedirect(openNotificationAction("n1"))).toBe("/dashboard/workrooms/w1");
		expect(markNotificationRead).toHaveBeenCalledWith(expect.anything(), "user-1", "n1");
	});

	it("stays on the inbox when the notification is not the user's", async () => {
		vi.mocked(markNotificationRead).mockResolvedValue({ data: null });

		const { pathname, params } = await expectRedirectTo(openNotificationAction("n1"));

		expect(pathname).toBe("/dashboard/notifications");
		expect(params.get("notificationError")).toBe("Notification not found.");
	});
});

describe("markAllNotificationsReadAction", () => {
	it("marks everything read and confirms on the inbox", async () => {
		vi.mocked(markAllNotificationsRead).mockResolvedValue({ data: null });

		const { pathname, params } = await expectRedirectTo(markAllNotificationsReadAction());

		expect(pathname).toBe("/dashboard/notifications");
		expect(params.get("notificationStatus")).toBe("All notifications marked read.");
		expect(markAllNotificationsRead).toHaveBeenCalledWith(expect.anything(), "user-1");
	});

	it("reports a failure on the inbox", async () => {
		vi.mocked(markAllNotificationsRead).mockResolvedValue({ error: "permission denied" });

		const { params } = await expectRedirectTo(markAllNotificationsReadAction());

		expect(params.get("notificationError")).toBe("permission denied");
	});
});
