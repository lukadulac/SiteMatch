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

vi.mock("@/lib/provider-service-requests/service", () => ({
	acceptServiceRequestForProvider: vi.fn(),
	cancelServiceRequestForClient: vi.fn(),
	rejectServiceRequestForProvider: vi.fn(),
}));

const REQUEST_ID = "request-1";

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
			data: { id: REQUEST_ID, status: "accepted", conversation_id: "conversation-1" },
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
});
