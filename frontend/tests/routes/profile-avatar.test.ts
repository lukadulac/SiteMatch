import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, POST } from "@/app/api/profile/avatar/route";
import { removeOwnAvatar, uploadOwnAvatar } from "@/lib/profiles/avatar";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseStub, stubUser } from "../helpers/supabase-stub";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
	createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/profiles/avatar", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/profiles/avatar")>()),
	removeOwnAvatar: vi.fn(),
	uploadOwnAvatar: vi.fn(),
}));

const URL_BASE = "http://localhost/api/profile/avatar";
const SAVED = { data: { avatarPath: "user-1/a.png", avatarUrl: "http://x/a.png" } };

function signIn(userId: string | null) {
	const stub = createSupabaseStub({}, { user: userId ? stubUser({ id: userId }) : null });
	vi.mocked(createSupabaseServerClient).mockResolvedValue(stub.client);
	return stub;
}

function uploadRequest(form: FormData, headers: Record<string, string> = {}) {
	// The multipart content-type (with its boundary) is added from the body.
	return new Request(URL_BASE, {
		method: "POST",
		body: form,
		headers: { origin: "http://localhost", ...headers },
	});
}

function avatarForm() {
	const form = new FormData();
	form.set("avatar", new Blob([new Uint8Array([0x89, 0x50])], { type: "image/png" }), "a.png");
	return form;
}

beforeEach(() => {
	vi.mocked(uploadOwnAvatar).mockReset().mockResolvedValue(SAVED);
	vi.mocked(removeOwnAvatar).mockReset().mockResolvedValue({ data: { avatarPath: null, avatarUrl: null } });
	signIn("user-1");
});

describe("POST /api/profile/avatar", () => {
	it("uploads the file for the signed-in user", async () => {
		const response = await POST(uploadRequest(avatarForm()));

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(SAVED);
		expect(vi.mocked(uploadOwnAvatar).mock.calls[0][1]).toBe("user-1");
		expect(vi.mocked(uploadOwnAvatar).mock.calls[0][2]).toBeInstanceOf(Blob);
	});

	it("rejects cross-origin requests", async () => {
		const response = await POST(uploadRequest(avatarForm(), { origin: "https://evil.example" }));

		expect(response.status).toBe(403);
		expect(uploadOwnAvatar).not.toHaveBeenCalled();
	});

	it("requires a signed-in user", async () => {
		signIn(null);

		expect((await POST(uploadRequest(avatarForm()))).status).toBe(401);
		expect(uploadOwnAvatar).not.toHaveBeenCalled();
	});

	it("rejects a body larger than the limit before reading it", async () => {
		const response = await POST(uploadRequest(avatarForm(), { "content-length": String(10 * 1024 * 1024) }));

		expect(response.status).toBe(413);
		expect(createSupabaseServerClient).not.toHaveBeenCalled();
		expect(uploadOwnAvatar).not.toHaveBeenCalled();
	});

	it("requires multipart form data with an avatar file", async () => {
		const json = new Request(URL_BASE, {
			method: "POST",
			body: "{}",
			headers: { origin: "http://localhost", "content-type": "application/json" },
		});
		expect((await POST(json)).status).toBe(415);

		const form = new FormData();
		form.set("avatar", "not a file");
		expect((await POST(uploadRequest(form))).status).toBe(400);
		expect(uploadOwnAvatar).not.toHaveBeenCalled();
	});

	it("passes service errors through with their status", async () => {
		vi.mocked(uploadOwnAvatar).mockResolvedValue({ error: "Upload a PNG, JPEG or WebP image.", status: 415 });

		const response = await POST(uploadRequest(avatarForm()));

		expect(response.status).toBe(415);
		expect(await response.json()).toEqual({ error: "Upload a PNG, JPEG or WebP image." });
	});
});

describe("DELETE /api/profile/avatar", () => {
	function deleteRequest(origin = "http://localhost") {
		return new Request(URL_BASE, { method: "DELETE", headers: { origin } });
	}

	it("removes the signed-in user's picture", async () => {
		const response = await DELETE(deleteRequest());

		expect(response.status).toBe(200);
		expect(vi.mocked(removeOwnAvatar).mock.calls[0][1]).toBe("user-1");
	});

	it("rejects cross-origin requests and guests", async () => {
		expect((await DELETE(deleteRequest("https://evil.example"))).status).toBe(403);

		signIn(null);
		expect((await DELETE(deleteRequest())).status).toBe(401);
		expect(removeOwnAvatar).not.toHaveBeenCalled();
	});
});
