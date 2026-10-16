import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..", "..");

function listFiles(dir: string, extensions: string[]): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);

		if (entry.isDirectory()) {
			return listFiles(path, extensions);
		}

		return extensions.some((extension) => entry.name.endsWith(extension))
			? [path]
			: [];
	});
}

function findRpcCalls() {
	const calls = new Map<string, string>();
	const files = ["lib", "app"].flatMap((dir) =>
		listFiles(join(root, dir), [".ts", ".tsx"]),
	);

	for (const file of files) {
		for (const match of readFileSync(file, "utf8").matchAll(
			/\.rpc\(\s*"([a-z0-9_]+)"/g,
		)) {
			calls.set(match[1], relative(root, file));
		}
	}

	return calls;
}

function readMigrations() {
	return listFiles(join(root, "supabase", "migrations"), [".sql"])
		.map((file) => readFileSync(file, "utf8"))
		.join("\n");
}

describe("supabase migrations", () => {
	it("define every database function the app calls through rpc", () => {
		const calls = findRpcCalls();
		const migrations = readMigrations();

		// Guards the scan itself: a broken regex would otherwise pass vacuously.
		expect(calls.has("accept_project_application")).toBe(true);
		expect(calls.has("auth_rate_limit_reset")).toBe(true);

		const undefinedCalls = [...calls]
			.filter(
				([name]) =>
					!new RegExp(
						`create\\s+(or\\s+replace\\s+)?function\\s+("?public"?\\.)?"?${name}"?\\s*\\(`,
						"i",
					).test(migrations),
			)
			.map(([name, file]) => `${name} (called in ${file})`);

		expect(undefinedCalls).toEqual([]);
	});
});
