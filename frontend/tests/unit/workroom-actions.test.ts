import { beforeEach, describe, expect, it, vi } from "vitest";
import { completeWorkroomAction } from "@/app/dashboard/workroom-actions";
import { completeWorkroomForProvider } from "@/lib/service-workrooms/service";
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

vi.mock("@/lib/service-workrooms/service", () => ({
	completeWorkroomForProvider: vi.fn(),
}));

const WORKROOM_ID = "22222222-2222-4222-8222-222222222222";

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
	signIn("provider-1");
});

describe("workroom actions", () => {
	it("requires auth before completing a workroom", async () => {
		signIn(null);

		const { pathname } = await expectRedirectTo(
			completeWorkroomAction(WORKROOM_ID),
		);

		expect(pathname).toBe("/login");
		expect(completeWorkroomForProvider).not.toHaveBeenCalled();
	});

	it("completes a workroom and redirects back to the provider workroom list", async () => {
		vi.mocked(completeWorkroomForProvider).mockResolvedValue({
			data: { id: WORKROOM_ID, status: "completed" },
		});

		const { pathname, params } = await expectRedirectTo(
			completeWorkroomAction(
				WORKROOM_ID,
				formData({
					context: "provider-workrooms",
					status: "active",
					page: "2",
				}),
			),
		);

		expect(pathname).toBe("/dashboard/provider/workrooms");
		expect(params.get("status")).toBe("active");
		expect(params.get("page")).toBe("2");
		expect(params.get("workroomStatus")).toBe("Workroom marked completed.");
		expect(completeWorkroomForProvider).toHaveBeenCalledWith(
			expect.anything(),
			"provider-1",
			WORKROOM_ID,
		);
		expect(revalidatePathMock).toHaveBeenCalledWith(
			`/dashboard/workrooms/${WORKROOM_ID}`,
		);
	});

	it("redirects detail actions back to the concrete workroom detail page", async () => {
		vi.mocked(completeWorkroomForProvider).mockResolvedValue({
			data: { id: WORKROOM_ID, status: "completed" },
		});

		const { pathname, params } = await expectRedirectTo(
			completeWorkroomAction(
				WORKROOM_ID,
				formData({ context: "provider-workroom-detail" }),
			),
		);

		expect(pathname).toBe(`/dashboard/workrooms/${WORKROOM_ID}`);
		expect(params.get("workroomStatus")).toBe("Workroom marked completed.");
	});

	it("does not accept arbitrary redirect contexts or invalid list params", async () => {
		vi.mocked(completeWorkroomForProvider).mockResolvedValue({
			data: { id: WORKROOM_ID, status: "completed" },
		});

		const { pathname, params } = await expectRedirectTo(
			completeWorkroomAction(
				WORKROOM_ID,
				formData({
					context: "https://evil.com",
					status: "evil",
					page: "-5",
				}),
			),
		);

		expect(pathname).toBe("/dashboard/provider/workrooms");
		expect(params.get("status")).toBeNull();
		expect(params.get("page")).toBeNull();
		expect(params.get("workroomStatus")).toBe("Workroom marked completed.");
	});

	it("rejects invalid workroom ids before calling the service layer", async () => {
		const { pathname, params } = await expectRedirectTo(
			completeWorkroomAction(
				"not-a-uuid",
				formData({ context: "provider-workroom-detail" }),
			),
		);

		expect(pathname).toBe("/dashboard/provider/workrooms");
		expect(params.get("workroomError")).toBe("Invalid workroom.");
		expect(completeWorkroomForProvider).not.toHaveBeenCalled();
	});
});
