import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

async function headersFor(source: string) {
	const rules = (await nextConfig.headers?.()) ?? [];

	return rules.filter((rule) => rule.source === source).flatMap((rule) => rule.headers);
}

describe("next.config headers", () => {
	it.each(["/login", "/register", "/forgot-password", "/reset-password"])(
		"sends Cache-Control: no-store for %s",
		async (source) => {
			const headers = await headersFor(source);

			expect(headers).toContainEqual({ key: "Cache-Control", value: "no-store, max-age=0" });
		},
	);
});
