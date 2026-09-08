import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { proxy } from "@/proxy";
import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware";
import { createSupabaseStub, stubUser } from "../helpers/supabase-stub";

vi.mock("@/lib/supabase/middleware", async () => {
	const actual = await vi.importActual<
		typeof import("@/lib/supabase/middleware")
	>("@/lib/supabase/middleware");

	return {
		...actual,
		createSupabaseMiddlewareClient: vi.fn(),
	};
});

const SESSION_COOKIE = "sb-access-token";

/**
 * Wires the proxy to a stubbed Supabase client and a response that already
 * carries a refreshed auth cookie, so every redirect can be checked for it.
 */
function arrange(user: { id: string } | null, role?: string | null) {
	const stub = createSupabaseStub(
		role === undefined ? {} : { "profiles.select": { data: role === null ? null : { role } } },
		{ user: user ? stubUser(user) : null },
	);

	const response = NextResponse.next();
	response.cookies.set(SESSION_COOKIE, "refreshed-token");

	vi.mocked(createSupabaseMiddlewareClient).mockReturnValue({
		supabase: stub.client,
		getResponse: () => response,
	});

	return stub;
}

function request(pathname: string) {
	return new NextRequest(new URL(pathname, "http://localhost"));
}

function redirectPath(response: Response) {
	const location = response.headers.get("location");

	return location ? new URL(location).pathname : null;
}

beforeEach(() => {
	vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
	vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
});

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("proxy", () => {
	it("passes the request through when Supabase is not configured", async () => {
		vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
		vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
		vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

		const response = await proxy(request("/dashboard"));

		expect(response.status).toBe(200);
		expect(createSupabaseMiddlewareClient).not.toHaveBeenCalled();
	});

	it("sends an anonymous visitor to the login page", async () => {
		arrange(null);

		const response = await proxy(request("/dashboard/client"));

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
});
