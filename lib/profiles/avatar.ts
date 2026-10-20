import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

type Client = SupabaseClient<Database>;

export const AVATAR_BUCKET = "avatars";
/** Matches the bucket's file_size_limit (supabase/migrations/20261020120000_profile_avatars.sql). */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const AVATAR_TYPES = {
	png: "image/png",
	jpg: "image/jpeg",
	webp: "image/webp",
} as const;

export type AvatarExtension = keyof typeof AVATAR_TYPES;

export type AvatarResult =
	| { data: { avatarPath: string | null; avatarUrl: string | null } }
	| { error: string; status: number };

function startsWith(bytes: Uint8Array, signature: number[], offset = 0) {
	return signature.every((byte, index) => bytes[offset + index] === byte);
}

/**
 * The image type from the file's first bytes. The browser-supplied name and
 * content type are not trusted.
 */
export function detectAvatarType(bytes: Uint8Array): AvatarExtension | null {
	if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
		return "png";
	}

	if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
		return "jpg";
	}

	// "RIFF" <size> "WEBP"
	if (
		startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
		startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
	) {
		return "webp";
	}

	return null;
}

/** Whether a stored avatar path belongs to the given user's folder. */
export function isOwnAvatarPath(path: string, userId: string) {
	return path.startsWith(`${userId}/`) && !path.slice(userId.length + 1).includes("/");
}

/** Public URL for a profiles.avatar_url path; null shows initials. */
export function getAvatarUrl(path: string | null | undefined) {
	const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

	if (!path || !baseUrl) {
		return null;
	}

	return `${baseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${AVATAR_BUCKET}/${path}`;
}

async function getCurrentAvatarPath(supabase: Client, userId: string) {
	const { data, error } = await supabase
		.from("profiles")
		.select("avatar_url")
		.eq("id", userId)
		.maybeSingle();

	if (error || !data) {
		return { error: true as const };
	}

	return { path: data.avatar_url };
}

/** Best effort: a file left behind is only wasted storage, never shown. */
async function removeAvatarFile(supabase: Client, path: string | null, userId: string) {
	if (!path || !isOwnAvatarPath(path, userId)) {
		return;
	}

	try {
		await supabase.storage.from(AVATAR_BUCKET).remove([path]);
	} catch {
		// Ignore; see above.
	}
}

/**
 * Stores a new profile picture for the signed-in user and replaces the old one.
 * Each upload gets a new file name, so cached URLs of the old picture never
 * show the new one.
 */
export async function uploadOwnAvatar(
	supabase: Client,
	userId: string,
	file: Blob,
): Promise<AvatarResult> {
	if (file.size === 0) {
		return { error: "Choose an image to upload.", status: 400 };
	}

	if (file.size > MAX_AVATAR_BYTES) {
		return { error: "The image must be 2 MB or smaller.", status: 413 };
	}

	const bytes = new Uint8Array(await file.arrayBuffer());
	const extension = detectAvatarType(bytes);

	if (!extension) {
		return { error: "Upload a PNG, JPEG or WebP image.", status: 415 };
	}

	const current = await getCurrentAvatarPath(supabase, userId);

	if ("error" in current) {
		return { error: "Your profile could not be loaded.", status: 400 };
	}

	const avatarPath = `${userId}/${crypto.randomUUID()}.${extension}`;
	const { error: uploadError } = await supabase.storage
		.from(AVATAR_BUCKET)
		.upload(avatarPath, bytes, {
			contentType: AVATAR_TYPES[extension],
			cacheControl: "31536000",
			upsert: false,
		});

	if (uploadError) {
		return { error: "The image could not be uploaded.", status: 400 };
	}

	const { error: updateError } = await supabase
		.from("profiles")
		.update({ avatar_url: avatarPath })
		.eq("id", userId);

	if (updateError) {
		await removeAvatarFile(supabase, avatarPath, userId);
		return { error: "Your profile picture could not be saved.", status: 400 };
	}

	await removeAvatarFile(supabase, current.path, userId);

	return { data: { avatarPath, avatarUrl: getAvatarUrl(avatarPath) } };
}

/** Removes the signed-in user's profile picture; initials show instead. */
export async function removeOwnAvatar(
	supabase: Client,
	userId: string,
): Promise<AvatarResult> {
	const current = await getCurrentAvatarPath(supabase, userId);

	if ("error" in current) {
		return { error: "Your profile could not be loaded.", status: 400 };
	}

	if (current.path) {
		const { error } = await supabase
			.from("profiles")
			.update({ avatar_url: null })
			.eq("id", userId);

		if (error) {
			return { error: "Your profile picture could not be removed.", status: 400 };
		}

		await removeAvatarFile(supabase, current.path, userId);
	}

	return { data: { avatarPath: null, avatarUrl: null } };
}

/**
 * Deletes every file in a user's avatars folder. Used after an admin deletes
 * the account (the database transaction already cleared avatar_url).
 */
export async function removeUserAvatarFolder(supabase: Client, userId: string) {
	const bucket = supabase.storage.from(AVATAR_BUCKET);
	const { data, error } = await bucket.list(userId, { limit: 100 });

	if (error) {
		return { error: error.message };
	}

	const paths = (data ?? []).map((file) => `${userId}/${file.name}`);

	if (paths.length === 0) {
		return { removed: 0 };
	}

	const { error: removeError } = await bucket.remove(paths);

	return removeError ? { error: removeError.message } : { removed: paths.length };
}
