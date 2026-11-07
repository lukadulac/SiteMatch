import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const script = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "scripts", "check-boundaries.mjs");
const roots: string[] = [];

function repo(files: Record<string, string>) {
	const root = mkdtempSync(join(tmpdir(), "boundaries-"));
	roots.push(root);

	for (const [path, content] of Object.entries(files)) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), content);
	}

	return root;
}

function run(root: string, ...extra: string[]) {
	return spawnSync(process.execPath, [script, "--root", root, "--no-allowlist", ...extra], { encoding: "utf8" });
}

const clean = {
	"frontend/lib/supabase/client.ts": 'import { createBrowserClient } from "@supabase/ssr";\n',
	"frontend/app/page.tsx": 'import { api } from "@/lib/api/server";\nconst x = Array.from(list);\n',
	"backend/src/modules/projects/service.ts": 'import type { Result } from "../../contracts/result.js";\nsupabase.from("projects");\n',
	"backend/src/routes/projects.ts": 'import { Router } from "express";\n',
	"backend/src/contracts/roles.ts": 'import { z } from "zod";\nimport { x } from "./x.js";\n',
};

afterEach(() => {
	for (const root of roots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

describe("check-boundaries.mjs", () => {
	it("passes a tree that respects every boundary", () => {
		const result = run(repo(clean));

		expect(result.stderr).toBe("");
		expect(result.status).toBe(0);
	});

	it.each([
		["a frontend @supabase import", "frontend/components/x.tsx", 'import { createClient } from "@supabase/supabase-js";', "frontend-supabase-import"],
		["a server client in the frontend", "frontend/lib/x.ts", "const client = createServerClient(url, key);", "frontend-server-supabase"],
		["a frontend query", "frontend/app/x/page.tsx", 'await supabase.from("projects").select();', "frontend-server-supabase"],
		["a frontend rpc", "frontend/app/x/actions.ts", "await supabase.rpc(name);", "frontend-server-supabase"],
		["the service-role key in the frontend", "frontend/lib/x.ts", "process.env.SUPABASE_SERVICE_ROLE_KEY;", "frontend-server-supabase"],
		["a frontend import of backend code", "frontend/lib/x.ts", 'import { a } from "../../backend/src/app.js";', "cross-project-import"],
		// Split, so the scan of this very file does not read it as an import.
		["a backend import of frontend code", "backend/src/x.ts", ["import { a } from", '"../../frontend/lib/x";'].join(" "), "cross-project-import"],
		["express in a module", "backend/src/modules/projects/handler.ts", 'import type { Request } from "express";', "module-imports-express"],
		["a contracts import of a package", "backend/src/contracts/x.ts", 'import { createClient } from "@supabase/supabase-js";', "contracts-import"],
		["a contracts import outside contracts", "backend/src/contracts/x.ts", 'import { env } from "../config/env.js";', "contracts-import"],
	])("fails on %s", (_label, path, content, rule) => {
		const result = run(repo({ ...clean, [path]: content }));

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(`${rule}: ${path}`);
	});
});
