import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { originGuard } from "../../src/middleware/origin-guard.js";

const SECRET = "test-internal-secret-0123456789abcdef";

function guardedApp() {
	const app = express();
	app.use(originGuard);
	app.all("/write", (_req, res) => { res.json({ data: "ok" }); });
	return app;
}

describe("originGuard", () => {
	it.each(["https://workbridge.test", "http://localhost:3000"])("allows a write from %s", async (origin) => {
		const response = await request(guardedApp()).post("/write").set("Origin", origin);

		expect(response.status).toBe(200);
	});

	it.each(["PATCH", "PUT", "DELETE"] as const)("guards %s as a write", async (method) => {
		const call = request(guardedApp())[method.toLowerCase() as "patch" | "put" | "delete"]("/write");
		const response = await call.set("Origin", "https://evil.test");

		expect(response.status).toBe(403);
	});

	it("rejects a write from an unlisted origin", async () => {
		const response = await request(guardedApp()).post("/write").set("Origin", "https://evil.test");

		expect(response.status).toBe(403);
		expect(response.body).toEqual({ error: "Invalid request origin." });
	});

	it("rejects a write with no Origin", async () => {
		const response = await request(guardedApp()).post("/write");

		expect(response.status).toBe(403);
	});

	it("rejects an origin that only starts like a listed one", async () => {
		const response = await request(guardedApp())
			.post("/write")
			.set("Origin", "https://workbridge.test.evil.test");

		expect(response.status).toBe(403);
	});

	it("allows a server-to-server write with the internal secret and no Origin", async () => {
		const response = await request(guardedApp()).post("/write").set("x-internal-secret", SECRET);

		expect(response.status).toBe(200);
	});

	it("rejects a wrong internal secret", async () => {
		const response = await request(guardedApp()).post("/write").set("x-internal-secret", `${SECRET}x`);

		expect(response.status).toBe(403);
	});

	it("lets reads through without an Origin", async () => {
		const response = await request(guardedApp()).get("/write");

		expect(response.status).toBe(200);
	});
});
