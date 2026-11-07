import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isAppRole } from "../../contracts/auth/roles.js";
import type { SessionState } from "../../contracts/session.js";
import type { Database } from "../../types/supabase.js";
import { isAccountEnabled } from "./account-access.js";

/** The checks proxy.ts made itself before EB2, in the same order. */
export async function getSessionState(
	supabase: SupabaseClient<Database>,
	user: User | null,
): Promise<SessionState> {
	if (!user) {
		return null;
	}

	const { data: profile } = await supabase
		.from("profiles")
		.select("role")
		.eq("id", user.id)
		.maybeSingle();

	if (!profile || !isAppRole(profile.role)) {
		return { user: { id: user.id }, role: null };
	}

	if (!(await isAccountEnabled(supabase, user.id))) {
		await supabase.auth.signOut({ scope: "local" });
		return null;
	}

	return { user: { id: user.id }, role: profile.role };
}
