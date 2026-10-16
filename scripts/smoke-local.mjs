// Local smoke test: drives the real Auth and REST API of the local Supabase stack.
//
//   npx supabase start && npm run smoke
//
// It creates throwaway users, checks what the app is allowed (and not allowed)
// to do as each of them, and deletes the users again. It refuses to run against
// anything but a local stack.

import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

function readLocalStack() {
	const output = execSync("npx supabase status -o env", {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "ignore"],
	});
	const env = {};

	for (const line of output.split(/\r?\n/)) {
		const match = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);

		if (match) {
			env[match[1]] = match[2];
		}
	}

	if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(env.API_URL ?? "")) {
		throw new Error(`Refusing to run: ${env.API_URL} is not a local Supabase stack.`);
	}

	return { url: env.API_URL, anonKey: env.ANON_KEY, serviceRoleKey: env.SERVICE_ROLE_KEY };
}

const stack = readLocalStack();
const runId = Date.now().toString(36);
const password = "Smoke-test-pass-1";
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(stack.url, stack.serviceRoleKey, noSession);
const createdUserIds = [];
const results = [];

async function check(name, run) {
	try {
		await run();
		results.push({ name, ok: true });
	} catch (error) {
		results.push({ name, ok: false, detail: error instanceof Error ? error.message : String(error) });
	}
}

function expect(condition, message) {
	if (!condition) {
		throw new Error(message);
	}
}

function expectDenied(error, message) {
	expect(error, `${message} (the write was allowed)`);
	expect(error.code === "42501", `${message} (failed with ${error.code}: ${error.message})`);
}

async function signUp(label, role) {
	const email = `smoke-${runId}-${label}@example.test`;
	const { data, error } = await admin.auth.admin.createUser({
		email,
		password,
		email_confirm: true,
		user_metadata: { role, full_name: `Smoke ${label}` },
	});

	if (error) {
		throw new Error(`createUser ${label}: ${error.message}`);
	}

	createdUserIds.push(data.user.id);

	const client = createClient(stack.url, stack.anonKey, noSession);
	const { error: signInError } = await client.auth.signInWithPassword({ email, password });

	if (signInError) {
		throw new Error(`signIn ${label}: ${signInError.message}`);
	}

	return { id: data.user.id, email, client };
}

// Same write as lib/auth/provision.ts.
function provisionProfile(user, role) {
	return user.client
		.from("profiles")
		.upsert({ id: user.id, role, full_name: "Smoke user", email: user.email }, { onConflict: "id" });
}

async function profileOf(id) {
	const { data } = await admin.from("profiles").select("role, is_active, full_name, city").eq("id", id).single();

	return data;
}

async function securityHardening() {
	const client = await signUp("client", "client");
	const sneaky = await signUp("sneaky", "client");

	await check("a new client can provision their own profile", async () => {
		const { error } = await provisionProfile(client, "client");

		expect(!error, error?.message);
	});

	await check("a new user cannot provision themselves as admin", async () => {
		const { error } = await provisionProfile(sneaky, "admin");

		expectDenied(error, "admin provisioning");
	});

	await check("a client cannot make themselves admin", async () => {
		const { error } = await client.client.from("profiles").update({ role: "admin" }).eq("id", client.id);

		expectDenied(error, "role escalation");
		expect((await profileOf(client.id)).role === "client", "the role changed anyway");
	});

	await check("a client cannot deactivate their own profile", async () => {
		const { error } = await client.client.from("profiles").update({ is_active: false }).eq("id", client.id);

		expectDenied(error, "is_active change");
	});

	await check("a client can still edit their own name and city", async () => {
		const { error } = await client.client
			.from("profiles")
			.update({ full_name: "Renamed", city: "Novi Sad" })
			.eq("id", client.id);

		expect(!error, error?.message);
		expect((await profileOf(client.id)).city === "Novi Sad", "the city was not saved");
	});
}

try {
	await securityHardening();
} finally {
	for (const id of createdUserIds) {
		await admin.auth.admin.deleteUser(id);
	}
}

for (const result of results) {
	console.log(`${result.ok ? "PASS" : "FAIL"}  ${result.name}${result.ok ? "" : `\n      ${result.detail}`}`);
}

const failed = results.filter((result) => !result.ok).length;

console.log(`\n${results.length - failed}/${results.length} smoke checks passed.`);
process.exit(failed === 0 ? 0 : 1);
