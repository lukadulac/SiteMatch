import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { removeUserAvatarFolder } from "@/lib/profiles/avatar";
import type { Database } from "@/lib/contracts/supabase";

type Client = SupabaseClient<Database>;

export type DeleteAccountResult =
	| { data: { userId: string } }
	| { error: string; fieldErrors?: Record<string, string[] | undefined> };

const deleteAccountSchema = z.object({
	email: z.string().trim().min(1, "Type your email to confirm.").max(254),
	password: z.string().min(1, "Enter your password.").max(72),
});

/**
 * Deletes the signed-in user's account. The caller retypes their email and password;
 * delete_own_account anonymises their data in one transaction, then the service-role
 * client soft-deletes the login (hard deletion is blocked by profiles.id -> auth.users).
 * `createAdminClient` is called only after the user is authenticated and confirmed.
 */
export async function deleteOwnAccount(
	supabase: Client,
	input: unknown,
	createAdminClient: () => Client,
): Promise<DeleteAccountResult> {
	const parsed = deleteAccountSchema.safeParse(input);
	if (!parsed.success) {
		return { error: "Check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
	}

	const { data: { user } } = await supabase.auth.getUser();
	if (!user?.email) {
		return { error: "Sign in again to delete your account." };
	}

	if (parsed.data.email.toLowerCase() !== user.email.toLowerCase()) {
		return { error: "Check the highlighted fields.", fieldErrors: { email: ["This is not the email of your account."] } };
	}

	// A fresh password check stands in for "recently signed in": a left-open session alone cannot delete.
	const { error: passwordError } = await supabase.auth.signInWithPassword({
		email: user.email,
		password: parsed.data.password,
	});
	if (passwordError) {
		return { error: "Check the highlighted fields.", fieldErrors: { password: ["Your password is incorrect."] } };
	}

	let admin: Client;
	try {
		admin = createAdminClient();
	} catch {
		return { error: "Account deletion is temporarily unavailable. Please try again later." };
	}

	const { error: deleteError } = await supabase.rpc("delete_own_account", { confirm_email: parsed.data.email });
	if (deleteError) {
		return { error: "Your account could not be deleted. Please try again later." };
	}

	// The data is already anonymised and the account gate is closed; the login goes next.
	// A failure here is recorded for admins (auth_deleted_at stays empty) and never shown as success.
	const { error: authError } = await admin.auth.admin.deleteUser(user.id, true);
	if (authError) {
		console.warn("Auth user deletion is pending", { code: authError.code ?? "unknown" });
		return { error: "Your data is removed and your account is closed, but sign-in removal is still pending. Contact support if you can still sign in." };
	}

	await admin
		.from("account_moderation")
		.update({ auth_deleted_at: new Date().toISOString() })
		.eq("user_id", user.id)
		.eq("status", "deleted");
	// Best effort: the profile no longer points at the files, so a leftover is never shown.
	try {
		await removeUserAvatarFolder(admin, user.id);
	} catch {
		// Ignore; see above.
	}

	return { data: { userId: user.id } };
}
