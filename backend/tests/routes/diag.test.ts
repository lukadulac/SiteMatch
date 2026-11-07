import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../../src/app.js";

// Temporary route (EB1); this test goes with it.
describe("/api/_diag", () => {
	it("reports what the request carried", async () => {
		const response = await request(app)
			.get("/api/_diag")
			.set("Origin", "https://workbridge.test")
			.set("x-forwarded-host", "workbridge.test")
			.set("Cookie", "a=1; b=2; c=3");

		expect(response.body.data).toMatchObject({
			origin: "https://workbridge.test",
			xForwardedHost: "workbridge.test",
			cookieCount: 3,
			cookieHeaderBytes: 13,
		});
	});

	it("sets two cookies on an allowed write", async () => {
		const response = await request(app).post("/api/_diag").set("Origin", "https://workbridge.test");
		const cookies = response.headers["set-cookie"] as unknown as string[];

		expect(response.status).toBe(200);
		expect(cookies).toHaveLength(2);
		expect(cookies.every((line) => /HttpOnly/.test(line) && /Secure/.test(line))).toBe(true);
	});
});
