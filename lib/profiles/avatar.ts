import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

type Client = SupabaseClient<Database>;

export const AVATAR_BUCKET = "avatars";
/** Matches the bucket's file_size_limit (supabase/migrations/20261020120000_profile_avatars.sql). */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
/**
 * The registration form is a Server Action, and Server Action bodies are capped
 * at 64 KB (next.config.ts), so the browser shrinks the picture below this first.
 */
export const MAX_REGISTRATION_AVATAR_BYTES = 48 * 1024;

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

/** Same rule as the profiles_avatar_url_own_path check constraint. */
const AVATAR_FILE_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$/;

function formatSize(bytes: number) {
	return bytes >= 1024 * 1024 ? `${bytes / (1024 * 1024)} MB` : `${Math.round(bytes / 1024)} KB`;
}

export type ValidAvatarFile = { bytes: Uint8Array; extension: AvatarExtension };

/** Checks a picked file's size and real type before anything is stored. */
export async function validateAvatarFile(
	file: Blob,
	maxBytes = MAX_AVATAR_BYTES,
): Promise<ValidAvatarFile | { error: string; status: number }> {
	if (file.size === 0) {
		return { error: "Choose an image to upload.", status: 400 };
	}

	if (file.size > maxBytes) {
		return { error: `The image must be ${formatSize(maxBytes)} or smaller.`, status: 413 };
	}

	const bytes = new Uint8Array(await file.arrayBuffer());
	const extension = detectAvatarType(bytes);

	if (!extension) {
		return { error: "Upload a PNG, JPEG or WebP image.", status: 415 };
	}

	return { bytes, extension };
}

function uploadAvatarFile(supabase: Client, userId: string, file: ValidAvatarFile) {
	const avatarPath = `${userId}/${crypto.randomUUID()}.${file.extension}`;

	return supabase.storage
		.from(AVATAR_BUCKET)
		.upload(avatarPath, file.bytes, {
			contentType: AVATAR_TYPES[file.extension],
			cacheControl: "31536000",
			upsert: false,
		})
		.then(({ error }) => ({ avatarPath, error }));
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
	const validFile = await validateAvatarFile(file);

	if ("error" in validFile) {
		return validFile;
	}

	const current = await getCurrentAvatarPath(supabase, userId);

	if ("error" in current) {
		return { error: "Your profile could not be loaded.", status: 400 };
	}

	const { avatarPath, error: uploadError } = await uploadAvatarFile(supabase, userId, validFile);

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

/**
 * Stores the picture chosen on the registration form. The account has no session
 * or profile row until the email is confirmed, so this runs with the service-role
 * client, right after sign-up created the account. ensureUserProfile() links the
 * file to the profile on the first sign-in.
 */
export async function uploadRegistrationAvatar(
	adminClient: Client,
	userId: string,
	file: ValidAvatarFile,
) {
	const { error } = await uploadAvatarFile(adminClient, userId, file);

	return error ? { error: error.message } : {};
}

/**
 * The most recent picture in a user's folder, for linking a registration upload
 * to a newly provisioned profile. Null when there is none or it cannot be read.
 */
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
