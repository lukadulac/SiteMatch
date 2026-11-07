import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { requireInternal } from "../../src/middleware/require-internal.js";

function internalApp() {
	const app = express();
	app.get("/internal", requireInternal, (_req, res) => { res.json({ data: "ok" }); });
	return app;
}

describe("requireInternal", () => {
	it("allows the current secret", async () => {
		const response = await request(internalApp())
			.get("/internal")
			.set("x-internal-secret", "test-internal-secret-0123456789abcdef");

		expect(response.status).toBe(200);
	});

	it("allows the second secret of a rotation list", async () => {
		const response = await request(internalApp())
			.get("/internal")
			.set("x-internal-secret", "test-rotated-secret-0123456789abcdef");

		expect(response.status).toBe(200);
	});

	it.each([
		["no secret", undefined],
		["an empty secret", ""],
		["a wrong secret", "test-internal-secret-0123456789abcdeX"],
		["a prefix of the secret", "test-internal-secret"],
		["both secrets joined", "test-internal-secret-0123456789abcdef,test-rotated-secret-0123456789abcdef"],
	])("rejects %s", async (_label, secret) => {
		const call = request(internalApp()).get("/internal");
		const response = await (secret === undefined ? call : call.set("x-internal-secret", secret));

		expect(response.status).toBe(403);
		expect(response.body).toEqual({ error: "Forbidden." });
	});
});
