import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		tsconfigPaths: true,
		alias: {
			// `server-only` is injected by the Next.js compiler, not by node_modules.
			"server-only": fileURLToPath(
				new URL("./tests/helpers/server-only.ts", import.meta.url),
			),
		},
	},
	test: {
		environment: "node",
		include: ["tests/**/*.test.ts"],
		clearMocks: true,
		restoreMocks: true,
		coverage: {
			provider: "v8",
			include: [
				"lib/**/*.ts",
				"app/api/**/*.ts",
				"app/**/actions.ts",
				"**/proxy.ts",
			],
		},
	},
});
