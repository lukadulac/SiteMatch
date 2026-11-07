// Fails when code crosses a boundary from spec/express-backend.md.
//
//   node scripts/check-boundaries.mjs
//   node scripts/check-boundaries.mjs --root <dir> --no-allowlist   # used by its own tests
//
// Until EB9, ALLOWLIST names the frontend files that still hold server-side Supabase code.
// Each task that moves a file must remove it here; an entry that no longer violates fails too.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const rootArg = args.indexOf("--root");
const root = rootArg >= 0 ? resolve(args[rootArg + 1]) : join(dirname(fileURLToPath(import.meta.url)), "..");
const useAllowlist = !args.includes("--no-allowlist");

const BROWSER_CLIENT = "frontend/lib/supabase/client.ts";

const ALLOWLIST = {
	"frontend-supabase-import": [
		"frontend/lib/account/delete-account.ts",
		"frontend/lib/admin/service.ts",
		"frontend/lib/auth/account-access.ts",
		"frontend/lib/auth/own-contact.ts",
		"frontend/lib/auth/provision.ts",
		"frontend/lib/auth/rate-limit.ts",
		"frontend/lib/messaging/service.ts",
		"frontend/lib/navigation/header-state.ts",
		"frontend/lib/notifications/service.ts",
		"frontend/lib/profiles/avatar.ts",
		"frontend/lib/profiles/public-profile.ts",
		"frontend/lib/projects/queries.ts",
		"frontend/lib/projects/service.ts",
		"frontend/lib/provider-service-requests/service.ts",
		"frontend/lib/provider-services/service.ts",
		"frontend/lib/service-workrooms/service.ts",
		"frontend/lib/supabase/admin.ts",
		"frontend/lib/supabase/middleware.ts",
		"frontend/lib/supabase/server.ts",
		"frontend/scripts/smoke-local.mjs",
		"frontend/tests/helpers/supabase-stub.ts",
		"frontend/tests/unit/provision.test.ts",
	],
	"frontend-server-supabase": [
		"frontend/app/api/projects/[id]/route.ts",
		"frontend/app/dashboard/actions.ts",
		"frontend/app/dashboard/client/page.tsx",
		"frontend/app/dashboard/client/profile/page.tsx",
		"frontend/app/dashboard/client/projects/page.tsx",
		"frontend/app/dashboard/provider/applications/page.tsx",
		"frontend/app/dashboard/provider/page.tsx",
		"frontend/app/dashboard/provider/profile/page.tsx",
		"frontend/app/dashboard/provider/service-requests/page.tsx",
		"frontend/app/dashboard/provider/services/[id]/page.tsx",
		"frontend/app/dashboard/provider/services/page.tsx",
		"frontend/app/dashboard/provider/services/post/page.tsx",
		"frontend/app/dashboard/provider/workrooms/page.tsx",
		"frontend/app/jobs/page.tsx",
		"frontend/app/oglasi/[id]/edit/page.tsx",
		"frontend/app/oglasi/novi/page.tsx",
		"frontend/app/oglasi/page.tsx",
		"frontend/lib/account/delete-account.ts",
		"frontend/lib/admin/service.ts",
		"frontend/lib/auth/account-access.ts",
		"frontend/lib/auth/own-contact.ts",
		"frontend/lib/auth/provision.ts",
		"frontend/lib/auth/rate-limit.ts",
		"frontend/lib/messaging/service.ts",
		"frontend/lib/navigation/header-state.ts",
		"frontend/lib/notifications/service.ts",
		"frontend/lib/profiles/avatar.ts",
		"frontend/lib/profiles/public-profile.ts",
		"frontend/lib/projects/queries.ts",
		"frontend/lib/projects/service.ts",
		"frontend/lib/provider-service-requests/service.ts",
		"frontend/lib/provider-services/service.ts",
		"frontend/lib/service-workrooms/service.ts",
		"frontend/lib/supabase/admin.ts",
		"frontend/lib/supabase/middleware.ts",
		"frontend/lib/supabase/server.ts",
		"frontend/proxy.ts",
		"frontend/scripts/smoke-local.mjs",
		"frontend/tests/unit/profile-columns.test.ts",
	],
};

const SKIP_DIRS = new Set(["node_modules", ".next", "coverage", "dist", "out", ".vercel"]);
const EXTENSIONS = /\.(ts|tsx|mts|cts|js|mjs|cjs)$/;
const SPECIFIER =
	/(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*|\bvi\.mock\(\s*)["']([^"']+)["']/g;
const SERVER_SUPABASE = [/\bcreateServerClient\b/, /\bSUPABASE_SERVICE_ROLE_KEY\b/, /\.rpc\(/, /\.from\("/];

function listFiles(dir) {
	if (!existsSync(dir)) {
		return [];
	}

	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);

		if (entry.isDirectory()) {
			return SKIP_DIRS.has(entry.name) ? [] : listFiles(path);
		}

		return EXTENSIONS.test(entry.name) ? [path] : [];
	});
}

function specifiers(source) {
	return [...source.matchAll(SPECIFIER)].map((match) => match[1]);
}

function isInside(path, dir) {
	return path === dir || path.startsWith(dir + sep);
}

const violations = [];

function report(rule, file, detail) {
	violations.push({ rule, file: relative(root, file).split(sep).join("/"), detail });
}

for (const project of ["frontend", "backend"]) {
	const projectDir = join(root, project);
	const other = project === "frontend" ? "backend" : "frontend";

	for (const file of listFiles(projectDir)) {
		const path = relative(root, file).split(sep).join("/");
		const source = readFileSync(file, "utf8");
		const imports = specifiers(source);

		for (const specifier of imports) {
			const crossesByPath = specifier.startsWith(".") && !isInside(resolve(dirname(file), specifier), projectDir);
			const namesOther = new RegExp(`(^|/)${other}/`).test(specifier);

			if (crossesByPath || namesOther) {
				report("cross-project-import", file, specifier);
			}
		}

		if (project === "frontend" && path !== BROWSER_CLIENT && !path.startsWith("frontend/lib/contracts/")) {
			for (const specifier of imports.filter((name) => name.startsWith("@supabase/"))) {
				report("frontend-supabase-import", file, specifier);
			}

			const serverCode = SERVER_SUPABASE.find((pattern) => pattern.test(source));

			if (serverCode) {
				report("frontend-server-supabase", file, serverCode.source);
			}
		}

		if (path.startsWith("backend/src/modules/")) {
			for (const specifier of imports.filter((name) => name === "express" || name.startsWith("express/"))) {
				report("module-imports-express", file, specifier);
			}
		}

		if (path.startsWith("backend/src/contracts/")) {
			const contractsDir = join(root, "backend", "src", "contracts");

			for (const specifier of imports) {
				const allowed = specifier === "zod" ||
					(specifier.startsWith(".") && isInside(resolve(dirname(file), specifier), contractsDir));

				if (!allowed) {
					report("contracts-import", file, specifier);
				}
			}
		}
	}
}

const allowlist = useAllowlist ? ALLOWLIST : {};
const allowed = (violation) => (allowlist[violation.rule] ?? []).includes(violation.file);
const failures = violations.filter((violation) => !allowed(violation));
const stale = Object.entries(allowlist).flatMap(([rule, files]) =>
	files
		.filter((file) => !violations.some((violation) => violation.rule === rule && violation.file === file))
		.map((file) => `${rule}: ${file}`),
);

if (args.includes("--print-violations")) {
	const byRule = {};
	for (const { rule, file } of violations) {
		byRule[rule] = [...new Set([...(byRule[rule] ?? []), file])].sort();
	}
	console.log(JSON.stringify(byRule, null, "\t"));
	process.exit(0);
}

if (failures.length > 0 || stale.length > 0) {
	for (const { rule, file, detail } of failures) {
		console.error(`${rule}: ${file} (${detail})`);
	}

	for (const entry of stale) {
		console.error(`stale allowlist entry, remove it from scripts/check-boundaries.mjs: ${entry}`);
	}

	process.exit(1);
}

const allowlisted = violations.length;
console.log(
	allowlisted > 0
		? `Boundaries hold (${new Set(violations.map((violation) => violation.file)).size} frontend files still allowlisted).`
		: "Boundaries hold.",
);
