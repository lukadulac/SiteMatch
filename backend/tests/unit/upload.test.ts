import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { upload } from "../../src/middleware/upload.js";

function uploadApp() {
	const app = express();
	app.post("/upload", upload(10), (req, res) => {
		res.json({ data: { size: req.file?.size ?? null, name: req.file?.originalname ?? null } });
	});
	return app;
}

describe("upload", () => {
	it("keeps one file in memory", async () => {
		const response = await request(uploadApp())
			.post("/upload")
			.attach("file", Buffer.from("12345"), "a.png");

		expect(response.body).toEqual({ data: { size: 5, name: "a.png" } });
	});

	it("rejects a file over the limit", async () => {
		const response = await request(uploadApp())
			.post("/upload")
			.attach("file", Buffer.alloc(11), "a.png");

		expect(response.status).toBe(413);
		expect(response.body).toEqual({ error: "The file is too large." });
	});

	it("rejects an unexpected file field", async () => {
		const response = await request(uploadApp())
			.post("/upload")
			.attach("other", Buffer.from("1"), "a.png");

		expect(response.status).toBe(400);
		expect(response.body).toEqual({ error: "Invalid upload." });
	});
});
