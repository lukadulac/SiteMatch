import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig from "../../next.config";

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("next.config rewrites", () => {
	it("sends /api and /auth to the backend only after every Next.js route", async () => {
		vi.stubEnv("BACKEND_URL", "http://127.0.0.1:4000");

		await expect(nextConfig.rewrites?.()).resolves.toEqual({
			beforeFiles: [],
			afterFiles: [],
			fallback: [
				{ source: "/api/:path*", destination: "http://127.0.0.1:4000/api/:path*" },
				{ source: "/auth/:path*", destination: "http://127.0.0.1:4000/auth/:path*" },
			],
		});
	});

	it("refuses to build without BACKEND_URL", async () => {
		vi.stubEnv("BACKEND_URL", "");

		await expect(nextConfig.rewrites?.()).rejects.toThrow("Set BACKEND_URL.");
	});
});
