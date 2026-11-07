import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		include: ["tests/**/*.test.ts"],
		clearMocks: true,
		restoreMocks: true,
		unstubGlobals: true,
		// Placeholders: config/env.ts validates on import, and tests never reach a real service.
		env: {
			SUPABASE_URL: "https://testproject.supabase.co",
			SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
			INTERNAL_API_SECRET: "test-internal-secret-0123456789abcdef,test-rotated-secret-0123456789abcdef",
			SITE_URL: "https://workbridge.test",
			FRONTEND_ORIGINS: "https://workbridge.test,http://localhost:3000",
			TRUST_PROXY_HOPS: "1",
		},
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts"],
		},
	},
});
