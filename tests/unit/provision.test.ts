import { describe, expect, it } from "vitest";
import { ensureUserProfile } from "@/lib/auth/provision";
import { createSupabaseStub, stubUser } from "../helpers/supabase-stub";
import type { User } from "@supabase/supabase-js";

const USER_ID = "user-1";

function user(metadata: Record<string, unknown> = {}, overrides: Partial<User> = {}) {
	return stubUser({
		id: USER_ID,
		email: "ana@example.com",
		user_metadata: metadata,
		...overrides,
	}) as User;
}

describe("ensureUserProfile", () => {
	it("short-circuits when a valid profile already exists", async () => {
		const stub = createSupabaseStub({
			"profiles.select": { data: { role: "provider" } },
		});

		const result = await ensureUserProfile(stub.client, user({ role: "client" }));

		expect(result).toEqual({ role: "provider" });
		expect(stub.callKeys()).toEqual(["profiles.select"]);
	});

	it("provisions the profile without reading or overwriting an existing row", async () => {
		// Profile columns email and phone are not readable, and an upsert that rewrites
		// them would have to read them (ON CONFLICT DO UPDATE ... excluded.email), so the
		// profiles insert is DO NOTHING on conflict.
		const stub = createSupabaseStub({
			"profiles.select": { data: null },
			"profiles.upsert": {},
			"client_profiles.upsert": {},
		});

		await ensureUserProfile(stub.client, user({ role: "client" }));

		expect(stub.callsFor("profiles.upsert")[0]?.options).toEqual({
			onConflict: "id",
			ignoreDuplicates: true,
		});
	});

	it("refuses to provision an account whose metadata has no valid role", async () => {
		for (const role of [undefined, "", "superuser", "admin"]) {
			const stub = createSupabaseStub({ "profiles.select": { data: null } });

			const result = await ensureUserProfile(stub.client, user({ role }));

			expect(result.error).toBe("Your account is missing a valid role.");
			expect(stub.callKeys()).not.toContain("profiles.upsert");
		}
	});

	it("re-provisions a profile row whose role is not a valid app role", async () => {
		const stub = createSupabaseStub({
			"profiles.select": { data: { role: "legacy" } },
			"profiles.upsert": {},
			"client_profiles.upsert": {},
		});

		const result = await ensureUserProfile(stub.client, user({ role: "client" }));

		expect(result).toEqual({ role: "client" });
		expect(stub.callKeys()).toContain("profiles.upsert");
	});

	it("surfaces a read error without writing", async () => {
		const stub = createSupabaseStub({
			"profiles.select": { error: { message: "connection lost" } },
		});

		const result = await ensureUserProfile(stub.client, user({ role: "client" }));

		expect(result.error).toBe("connection lost");
		expect(stub.callKeys()).not.toContain("profiles.upsert");
	});

	describe("display name fallback", () => {
		it("prefers the metadata full name", async () => {
			const stub = createSupabaseStub({
				"profiles.select": { data: null },
				"profiles.upsert": {},
				"client_profiles.upsert": {},
			});

			await ensureUserProfile(
				stub.client,
				user({ role: "client", full_name: "  Ana Petrovic  ", name: "ignored" }),
			);

			expect(stub.callsFor("profiles.upsert")[0]?.payload).toMatchObject({
				full_name: "Ana Petrovic",
			});
		});

		it("falls back to the metadata name, then the email local part", async () => {
			const nameStub = createSupabaseStub({
				"profiles.select": { data: null },
				"profiles.upsert": {},
				"client_profiles.upsert": {},
			});
			await ensureUserProfile(
				nameStub.client,
				user({ role: "client", name: "Ana" }),
			);

			expect(nameStub.callsFor("profiles.upsert")[0]?.payload).toMatchObject({
				full_name: "Ana",
			});

			const emailStub = createSupabaseStub({
				"profiles.select": { data: null },
				"profiles.upsert": {},
				"client_profiles.upsert": {},
			});
			await ensureUserProfile(emailStub.client, user({ role: "client" }));

			expect(emailStub.callsFor("profiles.upsert")[0]?.payload).toMatchObject({
				full_name: "ana",
			});
		});

		it("falls back to a placeholder when there is nothing to derive a name from", async () => {
			const stub = createSupabaseStub({
				"profiles.select": { data: null },
				"profiles.upsert": {},
				"client_profiles.upsert": {},
			});

			await ensureUserProfile(
				stub.client,
				user({ role: "client" }, { email: undefined }),
			);

			expect(stub.callsFor("profiles.upsert")[0]?.payload).toMatchObject({
				full_name: "New user",
			});
		});
	});

	describe("client provisioning", () => {
		it("copies the signup metadata into the client profile", async () => {
			const stub = createSupabaseStub({
				"profiles.select": { data: null },
				"profiles.upsert": {},
				"client_profiles.upsert": {},
			});

			await ensureUserProfile(
				stub.client,
				user({
					role: "client",
					full_name: "Ana",
					business_name: "Dulac Studio",
					business_type: "local_service",
					project_idea: "A booking site.",
					interested_solution_types: ["tech_it", "", "design_creative"],
				}),
			);

			expect(stub.callsFor("client_profiles.upsert")[0]?.payload).toMatchObject({
				user_id: USER_ID,
				business_name: "Dulac Studio",
				business_type: "local_service",
				interested_solution_types: ["tech_it", "design_creative"],
			});
		});

		it("falls back to the display name when no business name was given", async () => {
			const stub = createSupabaseStub({
				"profiles.select": { data: null },
				"profiles.upsert": {},
				"client_profiles.upsert": {},
			});

			await ensureUserProfile(
				stub.client,
				user({ role: "client", full_name: "Ana Petrovic" }),
			);

			expect(stub.callsFor("client_profiles.upsert")[0]?.payload).toMatchObject({
				business_name: "Ana Petrovic",
			});
		});

		it("defaults the solution types to an empty list when metadata is malformed", async () => {
			const stub = createSupabaseStub({
				"profiles.select": { data: null },
				"profiles.upsert": {},
				"client_profiles.upsert": {},
			});

			await ensureUserProfile(
				stub.client,
				user({ role: "client", interested_solution_types: "tech_it" }),
			);

			expect(stub.callsFor("client_profiles.upsert")[0]?.payload).toMatchObject({
				interested_solution_types: [],
			});
		});

		it("does not touch the provider profile table", async () => {
			const stub = createSupabaseStub({
				"profiles.select": { data: null },
				"profiles.upsert": {},
				"client_profiles.upsert": {},
			});

			await ensureUserProfile(stub.client, user({ role: "client" }));

			expect(stub.callKeys()).not.toContain("provider_profiles.upsert");
		});
	});

	describe("provider provisioning", () => {
		it("keeps a recognised provider type", async () => {
			for (const providerType of ["agency", "company", "studio", "other"]) {
				const stub = createSupabaseStub({
					"profiles.select": { data: null },
					"profiles.upsert": {},
					"provider_profiles.upsert": {},
				});

				await ensureUserProfile(
					stub.client,
					user({ role: "provider", provider_type: providerType }),
				);

				expect(
					stub.callsFor("provider_profiles.upsert")[0]?.payload,
				).toMatchObject({ provider_type: providerType });
			}
		});

		it("falls back to freelancer for a missing or unknown provider type", async () => {
			for (const providerType of [undefined, "wizard"]) {
				const stub = createSupabaseStub({
					"profiles.select": { data: null },
					"profiles.upsert": {},
					"provider_profiles.upsert": {},
				});

				await ensureUserProfile(
					stub.client,
					user({ role: "provider", provider_type: providerType }),
				);

				expect(
					stub.callsFor("provider_profiles.upsert")[0]?.payload,
				).toMatchObject({ provider_type: "freelancer" });
			}
		});

		it("leaves an existing provider profile alone", async () => {
			// Rewriting tax_id on conflict would read it back, and it is not readable.
			const stub = createSupabaseStub({
				"profiles.select": { data: null },
				"profiles.upsert": {},
				"provider_profiles.upsert": {},
			});

			await ensureUserProfile(stub.client, user({ role: "provider" }));

			expect(stub.callsFor("provider_profiles.upsert")[0]?.options).toEqual({
				onConflict: "user_id",
				ignoreDuplicates: true,
			});
		});

		it("guarantees at least one service category", async () => {
			const stub = createSupabaseStub({
				"profiles.select": { data: null },
				"profiles.upsert": {},
				"provider_profiles.upsert": {},
			});

			await ensureUserProfile(
				stub.client,
				user({ role: "provider", service_categories: [] }),
			);

			expect(stub.callsFor("provider_profiles.upsert")[0]?.payload).toMatchObject({
				service_categories: ["other"],
			});
		});

		it("accepts years of experience as a number or a numeric string", async () => {
			for (const value of [7, "7"]) {
				const stub = createSupabaseStub({
					"profiles.select": { data: null },
					"profiles.upsert": {},
					"provider_profiles.upsert": {},
				});

				await ensureUserProfile(
					stub.client,
					user({ role: "provider", years_of_experience: value }),
				);

				expect(
					stub.callsFor("provider_profiles.upsert")[0]?.payload,
				).toMatchObject({ years_of_experience: 7 });
			}
		});

		it("discards a negative or non-numeric experience value", async () => {
			for (const value of [-1, "many"]) {
				const stub = createSupabaseStub({
					"profiles.select": { data: null },
					"profiles.upsert": {},
					"provider_profiles.upsert": {},
				});

				await ensureUserProfile(
					stub.client,
					user({ role: "provider", years_of_experience: value }),
				);

				expect(
					stub.callsFor("provider_profiles.upsert")[0]?.payload,
				).toMatchObject({ years_of_experience: null });
			}
		});

		it("does not touch the client profile table", async () => {
			const stub = createSupabaseStub({
				"profiles.select": { data: null },
				"profiles.upsert": {},
				"provider_profiles.upsert": {},
			});

			await ensureUserProfile(stub.client, user({ role: "provider" }));

			expect(stub.callKeys()).not.toContain("client_profiles.upsert");
		});
	});

	describe("registration profile picture", () => {
		const AVATAR = "11111111-1111-4111-8111-111111111111.webp";

		function provisionStub(list: { data?: unknown; error?: { message: string } | null }) {
			return createSupabaseStub({
				"profiles.select": { data: null },
				"storage.avatars.list": list,
				"profiles.upsert": {},
				"client_profiles.upsert": {},
			});
		}

		it("links the picture uploaded at registration", async () => {
			const stub = provisionStub({ data: [{ name: AVATAR }] });

			await ensureUserProfile(stub.client, user({ role: "client" }));

			expect(stub.callsFor("storage.avatars.list")[0].payload).toEqual([
				USER_ID,
				{ limit: 10, sortBy: { column: "created_at", order: "desc" } },
			]);
			expect(stub.callsFor("profiles.upsert")[0].payload).toMatchObject({
				avatar_url: `${USER_ID}/${AVATAR}`,
			});
		});

		it("skips files the profile constraint would reject", async () => {
			const stub = provisionStub({ data: [{ name: "notes.txt" }, { name: ".emptyFolderPlaceholder" }] });

			await ensureUserProfile(stub.client, user({ role: "client" }));

			expect(stub.callsFor("profiles.upsert")[0].payload).not.toHaveProperty("avatar_url");
		});

		it("provisions without a picture when the folder cannot be read", async () => {
			const stub = provisionStub({ error: { message: "storage unavailable" } });

			const result = await ensureUserProfile(stub.client, user({ role: "client" }));

			expect(result).toEqual({ role: "client" });
			expect(stub.callsFor("profiles.upsert")[0].payload).not.toHaveProperty("avatar_url");
		});

		it("does not look for a picture when the profile already exists", async () => {
			const stub = createSupabaseStub({ "profiles.select": { data: { role: "client" } } });

			await ensureUserProfile(stub.client, user({ role: "client" }));

			expect(stub.callKeys()).not.toContain("storage.avatars.list");
		});
	});

	it("recognises an existing admin profile without provisioning from metadata", async () => {
		const stub = createSupabaseStub({
			"profiles.select": { data: { role: "admin" } },
		});

		const result = await ensureUserProfile(stub.client, user({ role: "admin" }));

		expect(result).toEqual({ role: "admin" });
		expect(stub.callKeys()).toEqual(["profiles.select"]);
	});

	it("surfaces a failure from the role-specific upsert", async () => {
		const stub = createSupabaseStub({
			"profiles.select": { data: null },
			"profiles.upsert": {},
			"client_profiles.upsert": { error: { message: "column missing" } },
		});

		const result = await ensureUserProfile(stub.client, user({ role: "client" }));

		expect(result.error).toBe("column missing");
	});
});
