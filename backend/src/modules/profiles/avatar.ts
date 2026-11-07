// Moved from frontend/lib/profiles/avatar.ts (findUploadedAvatarPath). Until EB8 the frontend keeps a temporary copy for
// callers that have not moved yet; see TEMPORARY_COPIES in scripts/check-boundaries.mjs.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/supabase.js";

type Client = SupabaseClient<Database>;

export const AVATAR_BUCKET = "avatars";

const AVATAR_FILE_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$/;

export async function findUploadedAvatarPath(supabase: Client, userId: string) {
	try {
		const { data, error } = await supabase.storage.from(AVATAR_BUCKET).list(userId, {
			limit: 10,
			sortBy: { column: "created_at", order: "desc" },
		});

		if (error) {
			return null;
		}

		const file = (data ?? []).find((item) => AVATAR_FILE_NAME.test(item.name));

		return file ? `${userId}/${file.name}` : null;
	} catch {
		return null;
	}
}
