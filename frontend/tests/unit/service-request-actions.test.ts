import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	acceptServiceRequestAction,
	cancelServiceRequestAction,
	rejectServiceRequestAction,
} from "@/app/dashboard/service-request-actions";
import {
	acceptServiceRequestForProvider,
	cancelServiceRequestForClient,
	rejectServiceRequestForProvider,
} from "@/lib/provider-service-requests/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { expectRedirectTo } from "../helpers/redirect";
import { createSupabaseStub, stubUser } from "../helpers/supabase-stub";

const revalidatePathMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
	redirect: (path: string) => {
		throw new Error(`NEXT_REDIRECT:${path}`);
	},
}));

vi.mock("next/cache", () => ({
	revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/supabase/server", () => ({
	createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/provider-service-requests/service", () => ({
	acceptServiceRequestForProvider: vi.fn(),
	cancelServiceRequestForClient: vi.fn(),
	rejectServiceRequestForProvider: vi.fn(),
}));

const REQUEST_ID = "11111111-1111-4111-8111-111111111111";

function formData(values: Record<string, string>) {
	const data = new FormData();

	for (const [key, value] of Object.entries(values)) {
		data.set(key, value);
	}

	return data;
}

function signIn(userId: string | null) {
	const stub = createSupabaseStub(
		{},
		{ user: userId ? stubUser({ id: userId }) : null },
	);

	vi.mocked(createSupabaseServerClient).mockResolvedValue(stub.client);

	return stub;
}

beforeEach(() => {
	vi.clearAllMocks();
	signIn("user-1");
});

describe("service request actions", () => {
	it("requires auth before accepting a request", async () => {
		signIn(null);

		const { pathname } = await expectRedirectTo(
			acceptServiceRequestAction(REQUEST_ID),
		);

		expect(pathname).toBe("/login");
		expect(acceptServiceRequestForProvider).not.toHaveBeenCalled();
	});

	it("accepts a request and redirects to provider services", async () => {
		vi.mocked(acceptServiceRequestForProvider).mockResolvedValue({
			data: {
				id: REQUEST_ID,
				status: "accepted",
				conversation_id: "conversation-1",
				workroom_id: "workroom-1",
			},
		});

		const { pathname, params } = await expectRedirectTo(
			acceptServiceRequestAction(REQUEST_ID),
		);

		expect(pathname).toBe("/dashboard/provider/services");
		expect(params.get("serviceStatus")).toBe("Service request accepted.");
		expect(acceptServiceRequestForProvider).toHaveBeenCalledWith(
			expect.anything(),
			"user-1",
			REQUEST_ID,
		);
		expect(revalidatePathMock).toHaveBeenCalledWith(
			`/dashboard/service-requests/${REQUEST_ID}`,
		);
	});

	it("rejects a request and reports service errors", async () => {
		vi.mocked(rejectServiceRequestForProvider).mockResolvedValue({
			error: "Service request could not be rejected.",
		});

		const { pathname, params } = await expectRedirectTo(
			rejectServiceRequestAction(REQUEST_ID),
		);

		expect(pathname).toBe("/dashboard/provider/services");
		expect(params.get("serviceError")).toBe(
			"Service request could not be rejected.",
		);
	});

	it("cancels a request from the client dashboard", async () => {
		vi.mocked(cancelServiceRequestForClient).mockResolvedValue({
			data: { id: REQUEST_ID, status: "cancelled", conversation_id: "conversation-1" },
		});

		const { pathname, params } = await expectRedirectTo(
			cancelServiceRequestAction(REQUEST_ID),
		);

		expect(pathname).toBe("/dashboard/client");
		expect(params.get("serviceStatus")).toBe("Service request cancelled.");
	});

	it("redirects provider decisions back to the filtered provider list", async () => {
		vi.mocked(acceptServiceRequestForProvider).mockResolvedValue({
			data: {
				id: REQUEST_ID,
				status: "accepted",
				conversation_id: "conversation-1",
				workroom_id: "workroom-1",
			},
		});

		const { pathname, params } = await expectRedirectTo(
			acceptServiceRequestAction(
				REQUEST_ID,
				formData({
					context: "provider-list",
					status: "pending",
					page: "2",
				}),
			),
		);

		expect(pathname).toBe("/dashboard/provider/service-requests");
		expect(params.get("status")).toBe("pending");
		expect(params.get("page")).toBe("2");
		expect(params.get("serviceStatus")).toBe("Service request accepted.");
	});

	it("redirects detail actions back to the concrete request detail page", async () => {
		vi.mocked(cancelServiceRequestForClient).mockResolvedValue({
			data: { id: REQUEST_ID, status: "cancelled", conversation_id: "conversation-1" },
		});

		const { pathname, params } = await expectRedirectTo(
			cancelServiceRequestAction(
				REQUEST_ID,
				formData({ context: "client-detail" }),
			),
		);

		expect(pathname).toBe(`/dashboard/service-requests/${REQUEST_ID}`);
		expect(params.get("serviceStatus")).toBe("Service request cancelled.");
	});

	it("does not accept arbitrary redirect contexts or invalid list params", async () => {
		vi.mocked(acceptServiceRequestForProvider).mockResolvedValue({
			data: {
				id: REQUEST_ID,
				status: "accepted",
				conversation_id: "conversation-1",
				workroom_id: "workroom-1",
			},
		});

		const { pathname, params } = await expectRedirectTo(
			acceptServiceRequestAction(
				REQUEST_ID,
				formData({
					context: "https://evil.com",
					status: "evil",
					page: "-5",
				}),
			),
		);

		expect(pathname).toBe("/dashboard/provider/services");
		expect(params.get("status")).toBeNull();
		expect(params.get("page")).toBeNull();
		expect(params.get("serviceStatus")).toBe("Service request accepted.");
	});

	it("rejects invalid request ids before calling the service layer", async () => {
		const { pathname, params } = await expectRedirectTo(
			rejectServiceRequestAction(
				"not-a-uuid",
				formData({ context: "provider-detail" }),
			),
		);

		expect(pathname).toBe("/dashboard/provider/service-requests");
		expect(params.get("serviceError")).toBe("Invalid service request.");
		expect(rejectServiceRequestForProvider).not.toHaveBeenCalled();
	});
});
