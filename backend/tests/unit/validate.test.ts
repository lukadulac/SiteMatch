import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { validate } from "../../src/middleware/validate.js";

function validatedApp() {
	const app = express();
	app.post("/items", express.json(), validate(z.object({ title: z.string().min(3) })), (_req, res) => {
		res.json({ data: res.locals.input });
	});
	app.get("/items", validate(z.object({ page: z.coerce.number().int().min(1) }), "query"), (_req, res) => {
		res.json({ data: res.locals.input });
	});
	return app;
}

describe("validate", () => {
	it("passes the parsed body on", async () => {
		const response = await request(validatedApp()).post("/items").send({ title: "Logo" });

		expect(response.body).toEqual({ data: { title: "Logo" } });
	});

	it("returns field errors in the shared format", async () => {
		const response = await request(validatedApp()).post("/items").send({ title: "x" });

		expect(response.status).toBe(400);
		expect(response.body.error).toBe("Validation failed.");
		expect(response.body.fieldErrors.title).toHaveLength(1);
	});

	it("parses the query string without writing to req.query", async () => {
		const response = await request(validatedApp()).get("/items?page=2");

		expect(response.body).toEqual({ data: { page: 2 } });
	});
});
