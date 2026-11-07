import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

const SESSION_COOKIE = "sb-project-auth-token";
const REFRESHED = `${SESSION_COOKIE}=refreshed-token; Path=/; Max-Age=34560000; SameSite=Lax`;

let backend: ReturnType<typeof vi.fn>;

/**
 * Stubs the backend's GET /api/session. Every answer carries a refreshed auth cookie, so
 * each redirect can be checked for it. Like the backend, a disabled account comes back as
 * null with its cookie cleared.
 */
function arrange(user: { id: string } | null, role?: string | null, enabled = true) {
	const setCookies = [REFRESHED];
	let data: unknown = null;

	if (user && enabled) {
		data = { user, role: role ?? null };
	} else if (user) {
		setCookies.push(`${SESSION_COOKIE}=; Path=/; Max-Age=0`);
	}

	backend.mockImplementation(async () => {
		const headers = new Headers({ "content-type": "application/json", "x-auth-cookie": SESSION_COOKIE });
		for (const line of setCookies) headers.append("set-cookie", line);
		return new Response(JSON.stringify({ data }), { status: 200, headers });
	});
}

function request(pathname: string, cookie = `${SESSION_COOKIE}=old-token`) {
	return new NextRequest(new URL(pathname, "http://localhost"), { headers: cookie ? { cookie } : {} });
}

function redirectPath(response: Response) {
	const location = response.headers.get("location");

	return location ? new URL(location).pathname : null;
}

beforeEach(() => {
	vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
	vi.stubEnv("BACKEND_URL", "http://backend.test");
	vi.stubEnv("INTERNAL_API_SECRET", "internal-secret-0123456789abcdef-0123");
	backend = vi.fn();
	vi.stubGlobal("fetch", backend);
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

describe("proxy", () => {
	it("sends a disabled account to the login page and passes on the cleared cookie", async () => {
		arrange({ id: "blocked-provider" }, "provider", false);

		const response = await proxy(request("/dashboard/provider"));

		expect(redirectPath(response)).toBe("/login");
		expect(response.cookies.get(SESSION_COOKIE)?.value).toBe("");
	});

	it("asks the backend with the browser's cookies and the internal secret", async () => {
		arrange({ id: "client-1" }, "client");

		await proxy(request("/dashboard/client"));

		const [url, init] = backend.mock.calls[0] as [string, RequestInit];
		const sent = new Headers(init.headers);
		expect(url).toBe("http://backend.test/api/session");
		expect(sent.get("cookie")).toBe(`${SESSION_COOKIE}=old-token`);
		expect(sent.get("x-internal-secret")).toBe("internal-secret-0123456789abcdef-0123");
	});

	it("sends an anonymous visitor to the login page", async () => {
		arrange(null);

		const response = await proxy(request("/dashboard/client", ""));

		expect(redirectPath(response)).toBe("/login");
	});

	it("sends a user without a profile row to the login page", async () => {
		arrange({ id: "ghost-1" }, null);

		const response = await proxy(request("/dashboard"));

		expect(redirectPath(response)).toBe("/login");
	});

	it("sends a user whose role is not an app role to the login page", async () => {
		arrange({ id: "legacy-1" }, "superuser");

		const response = await proxy(request("/dashboard"));

		expect(redirectPath(response)).toBe("/login");
	});

	it("keeps refreshed auth cookies on every redirect", async () => {
		arrange(null);

		const response = await proxy(request("/dashboard/client"));

		expect(response.cookies.get(SESSION_COOKIE)?.value).toBe("refreshed-token");
	});

	describe("session refresh", () => {
		it("gives the refreshed cookie to the browser and to this request's render", async () => {
			arrange({ id: "client-1" }, "client");

			const response = await proxy(request("/dashboard/client"));

			expect(redirectPath(response)).toBeNull();
			expect(response.cookies.get(SESSION_COOKIE)?.value).toBe("refreshed-token");
			expect(response.headers.get("x-middleware-request-cookie")).toContain(`${SESSION_COOKIE}=refreshed-token`);
			expect(response.headers.get("x-middleware-request-cookie")).not.toContain("old-token");
		});

		it("refreshes the session on a public page when a session cookie is present", async () => {
			arrange({ id: "client-1" }, "client");

			const response = await proxy(request("/jobs"));

			expect(backend).toHaveBeenCalledTimes(1);
			expect(redirectPath(response)).toBeNull();
			expect(response.cookies.get(SESSION_COOKIE)?.value).toBe("refreshed-token");
		});

		it("drops a cleared cookie from this request's render too", async () => {
			arrange({ id: "blocked-provider" }, "provider", false);

			const response = await proxy(request("/jobs"));

			expect(response.headers.get("x-middleware-request-cookie") ?? "").not.toContain("old-token");
		});
	});

	describe("session cookie name", () => {
		function replyWithCookieName(name: string | null) {
			const headers = new Headers({ "content-type": "application/json" });
			if (name) headers.set("x-auth-cookie", name);
			headers.append("set-cookie", REFRESHED);
			backend.mockResolvedValue(
				new Response(JSON.stringify({ data: { user: { id: "client-1" }, role: "client" } }), { status: 200, headers }),
			);
		}

		it("treats a backend on another Supabase URL as an outage, not a sign-out", async () => {
			const error = vi.spyOn(console, "error").mockImplementation(() => {});
			replyWithCookieName("sb-127-auth-token");

			const response = await proxy(request("/dashboard/client"));

			expect(response.status).toBe(503);
			expect(response.headers.get("set-cookie")).toBeNull();
			expect(error).toHaveBeenCalledWith(expect.stringContaining("Session cookie mismatch"));
		});

		it("treats a backend that does not report its cookie name the same way", async () => {
			vi.spyOn(console, "error").mockImplementation(() => {});
			replyWithCookieName(null);

			const response = await proxy(request("/dashboard/client"));

			expect(response.status).toBe(503);
		});

		it("still renders a public page, without the backend's cookies", async () => {
			vi.spyOn(console, "error").mockImplementation(() => {});
			replyWithCookieName("sb-127-auth-token");

			const response = await proxy(request("/jobs"));

			expect(response.status).toBe(200);
			expect(response.headers.get("set-cookie")).toBeNull();
		});
	});

	describe("backend outage", () => {
		it("returns 503 on a guarded page instead of signing the user out", async () => {
			backend.mockRejectedValue(new TypeError("fetch failed"));

			const response = await proxy(request("/dashboard/client"));

			expect(response.status).toBe(503);
			expect(redirectPath(response)).toBeNull();
			expect(response.headers.get("set-cookie")).toBeNull();
			expect(response.headers.get("content-security-policy")).toContain("'nonce-");
		});

		it("returns 503 when the backend answers with an error", async () => {
			backend.mockResolvedValue(new Response(JSON.stringify({ error: "Something went wrong." }), { status: 500 }));

			const response = await proxy(request("/oglasi/novi"));

			expect(response.status).toBe(503);
		});

		it("still renders a public page", async () => {
			backend.mockRejectedValue(new TypeError("fetch failed"));

			const response = await proxy(request("/jobs"));

			expect(response.status).toBe(200);
			expect(response.headers.get("set-cookie")).toBeNull();
		});
	});

	describe("/dashboard landing", () => {
		it("routes each role to its own dashboard", async () => {
			const cases = [
				{ role: "client", path: "/dashboard/client" },
				{ role: "provider", path: "/dashboard/provider" },
				{ role: "admin", path: "/dashboard/admin" },
			];

			for (const { role, path } of cases) {
				arrange({ id: "user-1" }, role);

				const response = await proxy(request("/dashboard"));

				expect(redirectPath(response), role).toBe(path);
			}
		});
	});

	describe("role-scoped dashboards", () => {
		it("lets each role into its own area", async () => {
			const cases = [
				{ role: "client", path: "/dashboard/client/projects" },
				{ role: "provider", path: "/dashboard/provider/applications" },
				{ role: "admin", path: "/dashboard/admin" },
			];

			for (const { role, path } of cases) {
				arrange({ id: "user-1" }, role);

				const response = await proxy(request(path));

				expect(redirectPath(response), role).toBeNull();
			}
		});

		it("bounces a role out of another role's area", async () => {
			const cases = [
				{ role: "provider", path: "/dashboard/client", to: "/dashboard/provider" },
				{ role: "admin", path: "/dashboard/client", to: "/dashboard/admin" },
				{ role: "client", path: "/dashboard/provider", to: "/dashboard/client" },
				{ role: "admin", path: "/dashboard/provider", to: "/dashboard/admin" },
				{ role: "client", path: "/dashboard/admin", to: "/dashboard/client" },
				{ role: "provider", path: "/dashboard/admin", to: "/dashboard/provider" },
			];

			for (const { role, path, to } of cases) {
				arrange({ id: "user-1" }, role);

				const response = await proxy(request(path));

				expect(redirectPath(response), `${role} -> ${path}`).toBe(to);
			}
		});

		it("guards nested paths, not just the area root", async () => {
			arrange({ id: "provider-1" }, "provider");

			const response = await proxy(request("/dashboard/client/projects/project-1"));

			expect(redirectPath(response)).toBe("/dashboard/provider");
		});
	});

	describe("/oglasi/novi", () => {
		it("lets a client create a listing", async () => {
			arrange({ id: "client-1" }, "client");

			const response = await proxy(request("/oglasi/novi"));

			expect(redirectPath(response)).toBeNull();
		});

		it("sends a provider to the public listing board", async () => {
			arrange({ id: "provider-1" }, "provider");

			const response = await proxy(request("/oglasi/novi"));

			expect(redirectPath(response)).toBe("/oglasi");
		});

		it("sends an admin to the admin dashboard", async () => {
			arrange({ id: "admin-1" }, "admin");

			const response = await proxy(request("/oglasi/novi"));

			expect(redirectPath(response)).toBe("/dashboard/admin");
		});
	});

	describe("Content-Security-Policy", () => {
		it("gives a signed-out visitor's public page a nonce policy without calling the backend", async () => {
			const response = await proxy(request("/find-talent", ""));
			const policy = response.headers.get("content-security-policy") ?? "";

			expect(policy).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
			expect(redirectPath(response)).toBeNull();
			expect(backend).not.toHaveBeenCalled();
		});

		it("forwards the nonce to rendering in the request headers", async () => {
			const response = await proxy(request("/"));
			const policy = response.headers.get("content-security-policy") ?? "";
			const nonce = policy.match(/'nonce-([^']+)'/)?.[1];

			expect(nonce).toBeTruthy();
			expect(response.headers.get("x-middleware-request-x-nonce")).toBe(nonce);
		});

		it("sets a fresh nonce on every request, guarded pages included", async () => {
			arrange({ id: "client-1" }, "client");

			const first = (await proxy(request("/dashboard/client"))).headers.get("content-security-policy");
			const second = (await proxy(request("/dashboard/client"))).headers.get("content-security-policy");

			expect(first).toContain("'nonce-");
			expect(first).not.toBe(second);
		});
	});
});
