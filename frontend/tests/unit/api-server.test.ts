import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cookies, headers } from "next/headers";
import { api } from "@/lib/api/server";

vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));

let backend: ReturnType<typeof vi.fn>;
let set: ReturnType<typeof vi.fn>;

beforeEach(() => {
	vi.stubEnv("BACKEND_URL", "http://backend.test");
	vi.stubEnv("INTERNAL_API_SECRET", "first-secret-0123456789abcdef0123,second-secret-0123456789abcdef");
	set = vi.fn();
	vi.mocked(cookies).mockResolvedValue({ toString: () => "sb-project-auth-token=abc", set } as never);
	vi.mocked(headers).mockResolvedValue(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }) as never);
	backend = vi.fn();
	vi.stubGlobal("fetch", backend);
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

function reply(status: number, body: unknown, setCookies: string[] = []) {
	const responseHeaders = new Headers({ "content-type": "application/json" });
	for (const line of setCookies) responseHeaders.append("set-cookie", line);
	backend.mockResolvedValue(new Response(JSON.stringify(body), { status, headers: responseHeaders }));
}

describe("api", () => {
	it("forwards the cookies, the internal secret and the client IP", async () => {
		reply(200, { data: { ok: true } });

		await api("/api/me/header", { method: "POST", headers: { "content-type": "application/json" } });

		const [url, init] = backend.mock.calls[0] as [string, RequestInit];
		const sent = new Headers(init.headers);
		expect(url).toBe("http://backend.test/api/me/header");
		expect(init.method).toBe("POST");
		expect(init.cache).toBe("no-store");
		expect(sent.get("cookie")).toBe("sb-project-auth-token=abc");
		expect(sent.get("x-internal-secret")).toBe("first-secret-0123456789abcdef0123");
		expect(sent.get("x-client-ip")).toBe("203.0.113.7");
		expect(sent.get("content-type")).toBe("application/json");
	});

	it("returns data and message", async () => {
		reply(201, { data: { id: "p-1" }, message: "Saved." });

		await expect(api("/api/x")).resolves.toEqual({ ok: true, status: 201, data: { id: "p-1" }, message: "Saved." });
	});

	it("returns the backend's error and field errors", async () => {
		reply(400, { error: "Validation failed.", fieldErrors: { title: ["Too short."] } });

		await expect(api("/api/x")).resolves.toEqual({
			ok: false,
			status: 400,
			error: "Validation failed.",
			fieldErrors: { title: ["Too short."] },
		});
	});

	it("reports an unreachable backend as 503", async () => {
		backend.mockRejectedValue(new TypeError("fetch failed"));

		await expect(api("/api/x")).resolves.toMatchObject({ ok: false, status: 503 });
	});

	it("stores cookies the backend sets", async () => {
		reply(200, { data: null }, ["sb-project-auth-token=new; Path=/; SameSite=Lax"]);

		await api("/api/x");

		expect(set).toHaveBeenCalledWith("sb-project-auth-token", "new", { path: "/", sameSite: "lax" });
	});
});
