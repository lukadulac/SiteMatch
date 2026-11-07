import express, { type Request, type Response } from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { env } from "../../src/config/env.js";
import { getAuthCookieName } from "../../src/contracts/auth/cookie-name.js";
import { createCookieMethods, createRequestClient } from "../../src/lib/supabase/request-client.js";
import { AUTH_COOKIE, fakeSession, sessionCookieHeader } from "../helpers/session-cookies.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const now = () => Math.floor(Date.now() / 1000);

function sessionApp() {
	const app = express();
	app.get("/session", async (req, res) => {
		const supabase = createRequestClient(req, res);
		const { data } = await supabase.auth.getSession();
		res.json({ userId: data.session?.user.id ?? null, accessToken: data.session?.access_token ?? null });
	});
	return app;
}

function setCookieHeaders(response: request.Response) {
	const header = response.headers["set-cookie"] as unknown as string[] | string | undefined;
	return header === undefined ? [] : Array.isArray(header) ? header : [header];
}

describe("createRequestClient", () => {
	it("reads a session split across several chunked cookies", async () => {
		// The name the proxy compares against (getAuthCookieName) is the one the library reads.
		expect(AUTH_COOKIE).toBe(getAuthCookieName(env.SUPABASE_URL));
		const cookie = sessionCookieHeader(fakeSession(USER_ID, now() + 3600, 6000));
		expect(cookie.split("; ").length).toBeGreaterThan(2);

		const response = await request(sessionApp()).get("/session").set("Cookie", cookie);

		expect(response.status).toBe(200);
		expect(response.body.userId).toBe(USER_ID);
		expect(setCookieHeaders(response)).toEqual([]);
	});

	it("writes a refreshed session back as chunked Set-Cookie headers", async () => {
		const refreshed = fakeSession(USER_ID, now() + 3600, 6000);
		const fetchMock = vi.fn(async (input: string | URL | Request) => {
			expect(String(input)).toContain("/auth/v1/token?grant_type=refresh_token");
			return new Response(JSON.stringify(refreshed), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		});
		vi.stubGlobal("fetch", fetchMock);

		const expired = sessionCookieHeader(fakeSession(USER_ID, now() - 60));
		const response = await request(sessionApp()).get("/session").set("Cookie", expired);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(response.body.accessToken).toBe(refreshed.access_token);

		const written = setCookieHeaders(response).filter((line) => line.startsWith(`${AUTH_COOKIE}.`));
		expect(written.length).toBeGreaterThan(1);
		expect(written.every((line) => /;\s*Path=\//i.test(line))).toBe(true);
	});

	it("does not write cookies once the response has been sent", async () => {
		const res = { headersSent: true, appendHeader: vi.fn(), setHeader: vi.fn() } as unknown as Response;
		const methods = createCookieMethods({ headers: {} } as Request, res);

		await methods.setAll?.([{ name: `${AUTH_COOKIE}.0`, value: "x", options: { path: "/" } }], {
			"Cache-Control": "private, no-store",
		});

		expect(res.appendHeader).not.toHaveBeenCalled();
		expect(res.setHeader).not.toHaveBeenCalled();
	});

	it("appends one Set-Cookie per cookie and forwards the cache headers", async () => {
		const res = { headersSent: false, appendHeader: vi.fn(), setHeader: vi.fn() } as unknown as Response;
		const methods = createCookieMethods({ headers: {} } as Request, res);

		await methods.setAll?.(
			[
				{ name: `${AUTH_COOKIE}.0`, value: "a", options: { path: "/" } },
				{ name: `${AUTH_COOKIE}.1`, value: "b", options: { path: "/" } },
			],
			{ "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0" },
		);

		expect(res.appendHeader).toHaveBeenCalledTimes(2);
		expect(res.setHeader).toHaveBeenCalledWith(
			"Cache-Control",
			"private, no-cache, no-store, must-revalidate, max-age=0",
		);
	});
});
