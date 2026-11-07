import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import app from "../../src/app.js";
import { errorHandler } from "../../src/middleware/error-handler.js";

describe("createApp", () => {
	it("answers the health check", async () => {
		const response = await request(app).get("/health");

		expect(response.status).toBe(200);
		expect(response.body).toEqual({ ok: true });
	});

	it("marks every API response private and uncacheable", async () => {
		const response = await request(app).get("/api/does-not-exist");

		expect(response.headers["cache-control"]).toBe("private, no-store");
	});

	it("does not advertise Express and sends helmet's headers", async () => {
		const response = await request(app).get("/health");

		expect(response.headers["x-powered-by"]).toBeUndefined();
		expect(response.headers["x-content-type-options"]).toBe("nosniff");
	});

	it("returns 404 in the shared error format", async () => {
		const response = await request(app).get("/api/does-not-exist");

		expect(response.status).toBe(404);
		expect(response.body).toEqual({ error: "Not found." });
	});

	it("applies the origin guard before any route", async () => {
		const response = await request(app).post("/api/does-not-exist").set("Origin", "https://evil.test");

		expect(response.status).toBe(403);
	});
});

describe("errorHandler", () => {
	function failingApp(error: Error) {
		const failing = express();
		failing.get("/fail", async () => { throw error; });
		failing.post("/json", express.json({ limit: "10b" }), (_req, res) => { res.json({}); });
		failing.use(errorHandler);
		return failing;
	}

	it("hides the error and its stack behind a generic 500", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const response = await request(failingApp(new Error('relation "profiles" does not exist'))).get("/fail");

		expect(response.status).toBe(500);
		expect(response.body).toEqual({ error: "Something went wrong." });
		expect(response.text).not.toContain("profiles");
		expect(response.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
	});

	it("reports bad and oversized JSON as client errors", async () => {
		const bad = await request(failingApp(new Error())).post("/json").set("content-type", "application/json").send("{");
		const large = await request(failingApp(new Error())).post("/json").send({ text: "x".repeat(50) });

		expect(bad.status).toBe(400);
		expect(bad.body).toEqual({ error: "Invalid JSON." });
		expect(large.status).toBe(413);
	});
});
