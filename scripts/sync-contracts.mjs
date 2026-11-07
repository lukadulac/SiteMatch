// Copies the shared contracts and the generated database types from the backend to the frontend.
//
//   node scripts/sync-contracts.mjs          # write frontend/lib/contracts/
//   node scripts/sync-contracts.mjs --check  # exit 1 if the copy has drifted (CI)
//
// backend/src/contracts/ is the source of truth. Never edit frontend/lib/contracts/ by hand.

import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const contractsSource = join(root, "backend", "src", "contracts");
const typesSource = join(root, "backend", "src", "types", "supabase.ts");
const target = join(root, "frontend", "lib", "contracts");
const check = process.argv.includes("--check");

function listFiles(dir) {
	if (!existsSync(dir)) {
		return [];
	}

	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		return entry.isDirectory() ? listFiles(path) : entry.name.endsWith(".ts") ? [path] : [];
	});
}

function banner(source) {
	return `// GENERATED from ${relative(root, source)} by scripts/sync-contracts.mjs. Do not edit;\n// change the backend file and run npm run contracts:sync.\n`;
}

// The backend uses NodeNext ("./roles.js"); the frontend resolves extensionless imports.
function toFrontendImports(source) {
	return source.replace(/(from\s+["']\.{1,2}\/[^"']+?)\.js(["'])/g, "$1$2");
}

/** Map of target path → expected content. */
function expectedFiles() {
	const files = new Map();

	for (const file of listFiles(contractsSource)) {
		const content = banner(file) + toFrontendImports(readFileSync(file, "utf8"));
		files.set(join(target, relative(contractsSource, file)), content);
	}

	files.set(join(target, "supabase.ts"), banner(typesSource) + readFileSync(typesSource, "utf8"));

	return files;
}

const expected = expectedFiles();
const existing = listFiles(target);

if (check) {
	const problems = [];

	for (const [path, content] of expected) {
		if (!existsSync(path)) {
			problems.push(`missing: ${relative(root, path)}`);
		} else if (readFileSync(path, "utf8") !== content) {
			problems.push(`changed: ${relative(root, path)}`);
		}
	}

	for (const path of existing) {
		if (!expected.has(path)) {
			problems.push(`not in the backend: ${relative(root, path)}`);
		}
	}

	if (problems.length > 0) {
		console.error(`frontend/lib/contracts has drifted from the backend:\n  ${problems.join("\n  ")}`);
		console.error("Run npm run contracts:sync and commit the result.");
		process.exit(1);
	}

	console.log(`Contracts in sync (${expected.size} files).`);
} else {
	for (const path of existing) {
		if (!expected.has(path)) {
			rmSync(path);
		}
	}

	for (const [path, content] of expected) {
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, content);
	}

	console.log(`Synced ${expected.size} contract files to ${relative(root, target)}.`);
}
