"use server";

import { redirect } from "next/navigation";
import { deleteOwnAccount } from "@/lib/account/delete-account";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type DeleteAccountState = {
	formError?: string;
	fieldErrors?: Record<string, string[] | undefined>;
};

export async function deleteAccountAction(
	_previousState: DeleteAccountState,
	formData: FormData,
): Promise<DeleteAccountState> {
	const supabase = await createSupabaseServerClient();
	const result = await deleteOwnAccount(
		supabase,
		{ email: formData.get("email") ?? "", password: formData.get("password") ?? "" },
		createSupabaseAdminClient,
	);

	if ("error" in result) {
		return { formError: result.error, fieldErrors: result.fieldErrors };
	}

	// The login is gone; clear this browser's session cookies.
	await supabase.auth.signOut({ scope: "local" });
	redirect("/login?deleted=1");
}
