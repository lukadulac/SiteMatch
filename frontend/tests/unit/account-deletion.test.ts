import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteOwnAccount } from "@/lib/account/delete-account";

vi.mock("@/lib/profiles/avatar", () => ({ removeUserAvatarFolder: vi.fn(async () => ({ removed: 0 })) }));

const user = { id: "user-1", email: "ana@example.com" };
const calls: string[] = [];

function createClient({
	signedIn = true,
	passwordOk = true,
	rpcError = null as { message: string } | null,
} = {}) {
	return {
		auth: {
			getUser: async () => ({ data: { user: signedIn ? user : null } }),
			signInWithPassword: async () => {
				calls.push("signInWithPassword");
				return { error: passwordOk ? null : { message: "Invalid login credentials" } };
			},
		},
		rpc: async (name: string, args: unknown) => {
			calls.push(`rpc:${name}:${JSON.stringify(args)}`);
			return { data: { id: user.id }, error: rpcError };
		},
	} as never;
}

function createAdmin({ deleteError = null as { message: string; code?: string } | null } = {}) {
	const update = vi.fn(() => ({ eq: () => ({ eq: async () => ({ error: null }) }) }));
	const admin = {
		auth: {
			admin: {
				deleteUser: async (id: string, soft: boolean) => {
					calls.push(`deleteUser:${id}:${soft}`);
					return { error: deleteError };
				},
			},
		},
		from: () => ({ update }),
	};
	return { admin: admin as never, update };
}

beforeEach(() => {
	calls.length = 0;
	vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("deleteOwnAccount", () => {
	it("needs the retyped email of the signed-in account", async () => {
		const { admin } = createAdmin();
		const result = await deleteOwnAccount(createClient(), { email: "other@example.com", password: "secret" }, () => admin);

		expect(result).toMatchObject({ fieldErrors: { email: ["This is not the email of your account."] } });
		expect(calls).toEqual([]);
	});

	it("needs the current password before changing anything", async () => {
		const { admin } = createAdmin();
		const result = await deleteOwnAccount(createClient({ passwordOk: false }), { email: "ana@example.com", password: "wrong" }, () => admin);

		expect(result).toMatchObject({ fieldErrors: { password: ["Your password is incorrect."] } });
		expect(calls).toEqual(["signInWithPassword"]);
	});

	it("refuses a signed-out caller", async () => {
		const { admin } = createAdmin();
		const result = await deleteOwnAccount(createClient({ signedIn: false }), { email: "ana@example.com", password: "secret" }, () => admin);

		expect(result).toEqual({ error: "Sign in again to delete your account." });
	});

	it("stops before deleting when the service role is not configured", async () => {
		const result = await deleteOwnAccount(createClient(), { email: "ana@example.com", password: "secret" }, () => {
			throw new Error("missing key");
		});

		expect("error" in result && result.error).toMatch(/temporarily unavailable/);
		expect(calls.some((call) => call.startsWith("rpc:"))).toBe(false);
	});

	it("anonymises the data, then soft-deletes the login and records it", async () => {
		const { admin, update } = createAdmin();
		const result = await deleteOwnAccount(createClient(), { email: " ANA@example.com ", password: "secret" }, () => admin);

		expect(result).toEqual({ data: { userId: "user-1" } });
		expect(calls).toEqual([
			"signInWithPassword",
			'rpc:delete_own_account:{"confirm_email":"ANA@example.com"}',
			"deleteUser:user-1:true",
		]);
		expect(update).toHaveBeenCalledWith({ auth_deleted_at: expect.any(String) });
	});

	it("does not report success when the login could not be removed", async () => {
		const { admin, update } = createAdmin({ deleteError: { message: "boom" } });
		const result = await deleteOwnAccount(createClient(), { email: "ana@example.com", password: "secret" }, () => admin);

		expect("error" in result && result.error).toMatch(/sign-in removal is still pending/);
		expect(update).not.toHaveBeenCalled();
	});
});
