import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..", "..");

function listFiles(dir: string, extension: RegExp): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);

		if (entry.isDirectory()) {
			return listFiles(path, extension);
		}

		return extension.test(entry.name) ? [path] : [];
	});
}

function splitTopLevel(list: string) {
	const items: string[] = [];
	let depth = 0;
	let current = "";

	for (const character of list) {
		if (character === "(") depth += 1;
		if (character === ")") depth -= 1;

		if (character === "," && depth === 0) {
			items.push(current.trim());
			current = "";
		} else {
			current += character;
		}
	}

	items.push(current.trim());

	return items.filter(Boolean);
}

/** The plain columns of a select list: nested embeds are skipped, `alias:column` keeps the column. */
function plainColumns(list: string) {
	return splitTopLevel(list)
		.filter((item) => !item.includes("("))
		.map((item) => item.split(":").pop()?.trim() ?? item);
}

/** Columns requested by every `profiles(...)` / `profiles!fk!inner(...)` embed in a source string. */
export function extractProfileEmbeds(source: string): string[][] {
	const embeds: string[][] = [];

	for (const match of source.matchAll(/\bprofiles(?:![\w.]+)*\(/g)) {
		let depth = 1;
		let index = match.index + match[0].length;
		const start = index;

		while (index < source.length && depth > 0) {
			if (source[index] === "(") depth += 1;
			if (source[index] === ")") depth -= 1;
			index += 1;
		}

		embeds.push(plainColumns(source.slice(start, index - 1)));
	}

	return embeds;
}

/** Index just past the `)` that closes the `(` at `open`, or -1 when it never closes. */
function endOfCall(source: string, open: number) {
	let depth = 0;

	for (let index = open; index < source.length; index += 1) {
		if (source[index] === "(") depth += 1;
		if (source[index] === ")") depth -= 1;
		if (depth === 0) return index + 1;
	}

	return -1;
}

/** Columns requested by every select chained onto `.from("profiles")`, including after update/insert. */
export function extractProfileChainSelects(source: string): string[][] {
	const selects: string[][] = [];

	for (const from of source.matchAll(/\.from\(\s*["']profiles["']\s*\)/g)) {
		let index = from.index + from[0].length;

		// Walk `.method(args)` links until the chain ends.
		for (;;) {
			const link = /^\s*\.(\w+)\(/.exec(source.slice(index));

			if (!link) break;

			const open = index + link[0].length - 1;
			const close = endOfCall(source, open);

			if (close === -1) break;

			if (link[1] === "select") {
				const argument = source.slice(open + 1, close - 1).trim();
				const literal = /^(["'`])([^"'`]*)\1/.exec(argument);

				if (!argument) {
					selects.push(["*"]);
				} else if (literal) {
					selects.push(plainColumns(literal[2]));
				} else {
					selects.push(["<non-literal select>"]);
				}
			}

			index = close;
		}
	}

	return selects;
}

/** The columns the migrations grant to signed-in users on profiles (the last such grant wins). */
function readGrantedProfileColumns() {
	const migrations = listFiles(join(root, "supabase", "migrations"), /\.sql$/)
		.sort()
		.map((file) => readFileSync(file, "utf8"))
		.join("\n");
	const grants = [
		...migrations.matchAll(/grant\s+select\s*\(([^)]*)\)\s+on\s+public\.profiles\s+to\s+[^;]*\bauthenticated\b/gi),
	];
	const last = grants.at(-1);

	return new Set(last ? last[1].split(",").map((column) => column.trim()) : []);
}

function findProfileColumnReads() {
	const reads: Array<{ file: string; columns: string[] }> = [];
	const files = ["app", "lib", "components"].flatMap((dir) =>
		listFiles(join(root, dir), /\.(ts|tsx)$/),
	);

	for (const file of files) {
		const source = readFileSync(file, "utf8");
		const path = relative(root, file);

		for (const columns of [...extractProfileEmbeds(source), ...extractProfileChainSelects(source)]) {
			reads.push({ file: path, columns });
		}
	}

	return reads;
}

describe("profile column scan", () => {
	it("reads embeds with hints, !inner, aliases and nested embeds", () => {
		expect(extractProfileEmbeds("provider:profiles!applications_provider_id_fkey!inner(id, email)")).toEqual([
			["id", "email"],
		]);
		expect(extractProfileEmbeds("profiles!fk(id, full_name, projects(id, title), phone)")).toEqual([
			["id", "full_name", "phone"],
		]);
		expect(extractProfileEmbeds("owner:profiles(name:full_name, city)")).toEqual([["full_name", "city"]]);
	});

	it("reads selects chained after update and insert, and bare selects", () => {
		expect(
			extractProfileChainSelects('await supabase.from("profiles").update({ a: 1 }).eq("id", id).select("email");'),
		).toEqual([["email"]]);
		expect(extractProfileChainSelects('supabase.from("profiles").insert(row).select();')).toEqual([["*"]]);
		expect(extractProfileChainSelects('supabase.from("profiles").select(columns)')).toEqual([
			["<non-literal select>"],
		]);
		expect(extractProfileChainSelects('supabase.from("profiles").select("id, full_name").eq("id", id)')).toEqual([
			["id", "full_name"],
		]);
	});
});

describe("profiles column reads", () => {
	const readable = readGrantedProfileColumns();
	const reads = findProfileColumnReads();

	it("takes the readable columns from the migration grant", () => {
		expect(readable.has("full_name")).toBe(true);
		expect(readable.has("email")).toBe(false);
		expect(readable.has("phone")).toBe(false);
	});

	it("finds the selects it is meant to check", () => {
		// Guards the scan itself: a broken regex would otherwise pass vacuously.
		expect(reads.length).toBeGreaterThan(10);
		expect(reads.some((read) => read.columns.includes("full_name"))).toBe(true);
	});

	it("only ask for columns every signed-in user may read", () => {
		// email and phone are readable only through get_own_contact_details().
		const unreadable = reads.flatMap((read) =>
			read.columns
				.filter((column) => !readable.has(column))
				.map((column) => `${column} (selected in ${read.file})`),
		);

		expect(unreadable).toEqual([]);
	});
});
