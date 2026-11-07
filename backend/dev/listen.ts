// Local runner only. On Vercel, src/app.ts is the entrypoint and nothing calls listen.
import { existsSync } from "node:fs";

// Like Next.js: .env.local overrides .env (loadEnvFile never replaces a variable already set).
for (const file of [".env.local", ".env"]) {
	if (existsSync(file)) {
		process.loadEnvFile(file);
	}
}

// Imported after the env files, because config/env.ts validates on import.
const { default: app } = await import("../src/app.js");
const { env } = await import("../src/config/env.js");

app.listen(env.PORT, (error) => {
	if (error) {
		throw error;
	}

	console.info(`Backend listening on http://127.0.0.1:${env.PORT}`);
});
