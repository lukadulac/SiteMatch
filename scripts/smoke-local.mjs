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

// Same write as lib/auth/provision.ts: a plain insert that leaves an existing row alone.
function provisionProfile(user, role, details = {}) {
	return user.client.from("profiles").upsert(
		{ id: user.id, role, full_name: "Smoke user", email: user.email, ...details },
		{ onConflict: "id", ignoreDuplicates: true },
	);
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

async function profilePrivacy() {
	const client = await signUp("privacy-client", "client");
	const provider = await signUp("privacy-provider", "provider");
	const outsider = await signUp("privacy-outsider", "client");

	for (const [user, role, phone, city] of [
		[client, "client", "+381 60 111", "Belgrade"],
		[provider, "provider", "+351 91 333", "Lisbon"],
		[outsider, "client", "+381 60 999", "Nis"],
	]) {
		const { error } = await provisionProfile(user, role, { phone, city, country: "Serbia" });

		if (error) {
			throw new Error(`provisioning ${role}: ${error.message}`);
		}
	}

	await admin.from("client_profiles").insert({
		user_id: client.id,
		business_name: "Smoke Ltd",
		business_tax_id: "100000001",
		project_idea: "A shop",
	});

	await check("provisioning stored the new user's email and phone", async () => {
		const { data } = await admin.from("profiles").select("email, phone").eq("id", provider.id).single();

		expect(data.email === provider.email && data.phone === "+351 91 333", "contact details missing");
	});

	await check("another user's name and location are readable", async () => {
		const { data, error } = await client.client
			.from("profiles")
			.select("id, full_name, country, city")
			.eq("id", provider.id)
			.single();

		expect(!error, error?.message);
		expect(data.city === "Lisbon", "city was not returned");
	});

	await check("another user's email is not readable", async () => {
		const { error } = await client.client.from("profiles").select("email").eq("id", provider.id);

		expectDenied(error, "email read");
	});

	await check("another user's phone is not readable", async () => {
		const { error } = await client.client.from("profiles").select("phone").eq("id", provider.id);

		expectDenied(error, "phone read");
	});

	await check("select * on profiles is not allowed", async () => {
		const { error } = await client.client.from("profiles").select("*").eq("id", provider.id);

		expectDenied(error, "select *");
	});

	await check("a user reads their own email and phone through get_own_contact_details()", async () => {
		const { data, error } = await client.client.rpc("get_own_contact_details");

		expect(!error, error?.message);
		expect(data?.[0]?.email === client.email && data[0].phone === "+381 60 111", "wrong contact details");
	});

	await check("a user still edits their own phone", async () => {
		const { error } = await provider.client.from("profiles").update({ phone: "+351 91 444" }).eq("id", provider.id);

		expect(!error, error?.message);

		const { data } = await provider.client.rpc("get_own_contact_details");

		expect(data?.[0]?.phone === "+351 91 444", "the new phone was not returned");
	});

	await check("setting your email to a registered address neither errors nor changes it", async () => {
		const { error } = await client.client.from("profiles").update({ email: provider.email }).eq("id", client.id);

		expect(!error, `the write was rejected (${error?.code}), which reveals the address is registered`);
		expect((await admin.from("profiles").select("email").eq("id", client.id).single()).data.email === client.email, "the email changed");
	});

	await check("a signed-out visitor reads no profile rows and no contact columns", async () => {
		const visitor = createClient(stack.url, stack.anonKey, noSession);
		const { data, error } = await visitor.from("profiles").select("id, full_name");
		const { error: emailError } = await visitor.from("profiles").select("email");

		expect(!error && data.length === 0, `signed-out read returned ${error?.message ?? data.length} rows`);
		expectDenied(emailError, "anonymous email read");
	});

	await check("a client's tax ID is hidden from other users and visible to the owner", async () => {
		const { data: asProvider } = await provider.client.from("client_profiles").select("business_tax_id");
		const { data: asOutsider } = await outsider.client.from("client_profiles").select("business_tax_id");
		const { data: asOwner } = await client.client.from("client_profiles").select("business_tax_id");

		expect(asProvider.length === 0 && asOutsider.length === 0, "another user read a client profile");
		expect(asOwner[0]?.business_tax_id === "100000001", "the owner could not read their tax ID");
	});

	await check("an application lists its provider's name and location for the client", async () => {
		const { data: project, error: projectError } = await client.client
			.from("projects")
			.insert({
				client_id: client.id,
				title: "Smoke brief",
				slug: `smoke-brief-${runId}`,
				description: "A brief used by the smoke test.",
				status: "published",
			})
			.select("id")
			.single();

		expect(!projectError, projectError?.message);

		const { error: applyError } = await provider.client.from("applications").insert({
			project_id: project.id,
			provider_id: provider.id,
			cover_message: "I can do this.",
		});

		expect(!applyError, applyError?.message);

		const { data, error } = await client.client
			.from("applications")
			.select("id, status, provider:profiles!applications_provider_id_fkey(id, full_name, country, city)")
			.eq("project_id", project.id);

		expect(!error, error?.message);
		expect(data[0]?.provider?.city === "Lisbon", "the provider embed came back empty");
	});
}

try {
	await securityHardening();
	await profilePrivacy();
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
