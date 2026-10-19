import { describe, expect, it } from "vitest";
import { getOwnContactDetails } from "@/lib/auth/own-contact";
import { createSupabaseStub } from "../helpers/supabase-stub";

describe("getOwnContactDetails", () => {
	it("returns the caller's email and phone from the RPC", async () => {
		const supabase = createSupabaseStub({
			"rpc.get_own_contact_details": {
				data: [{ email: "me@example.com", phone: "+381 60 111" }],
			},
		});

		const result = await getOwnContactDetails(supabase.client);

		expect(result).toEqual({ data: { email: "me@example.com", phone: "+381 60 111" } });
		expect(supabase.calls.map((call) => call.key)).toEqual(["rpc.get_own_contact_details"]);
	});

	it("keeps a missing phone as null", async () => {
		const supabase = createSupabaseStub({
			"rpc.get_own_contact_details": { data: [{ email: "me@example.com", phone: null }] },
		});

		const result = await getOwnContactDetails(supabase.client);

		expect(result).toEqual({ data: { email: "me@example.com", phone: null } });
	});

	it("returns a user-facing error instead of the database error", async () => {
		const supabase = createSupabaseStub({
			"rpc.get_own_contact_details": {
				error: { message: 'permission denied for function "get_own_contact_details"' },
			},
		});

		const result = await getOwnContactDetails(supabase.client);

		expect(result).toEqual({ error: "Your contact details could not be loaded." });
	});

	it("returns the same error when the caller has no profile row", async () => {
		const supabase = createSupabaseStub({ "rpc.get_own_contact_details": { data: [] } });

		const result = await getOwnContactDetails(supabase.client);

		expect(result).toEqual({ error: "Your contact details could not be loaded." });
	});
});
