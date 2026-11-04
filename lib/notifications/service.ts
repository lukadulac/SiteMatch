import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

type Result<T> =
	| { data: T; error?: never }
	| { data?: never; error: string };

/** Unread notifications for the header badge. Row level security limits it to the user's own. */
export async function getUnreadNotificationCount(
	supabase: SupabaseClient<Database>,
	userId: string,
): Promise<Result<number>> {
	const { count, error } = await supabase
		.from("notifications")
		.select("id", { count: "exact", head: true })
		.eq("user_id", userId)
		.is("read_at", null);

	if (error) {
		return { error: error.message };
	}

	return { data: count ?? 0 };
}
