import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	MAX_AVATAR_BYTES,
	detectAvatarType,
	getAvatarUrl,
	isOwnAvatarPath,
	removeOwnAvatar,
	uploadOwnAvatar,
} from "@/lib/profiles/avatar";
import { createSupabaseStub } from "../helpers/supabase-stub";

const USER_ID = "00000000-0000-4000-8000-00000000a001";
const OLD_PATH = `${USER_ID}/11111111-1111-4111-8111-111111111111.png`;
const NEW_UUID = "99999999-9999-4999-8999-999999999999";

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0x10, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];
const GIF = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0];

function image(bytes: number[], type = "image/png") {
	return new Blob([new Uint8Array(bytes)], { type });
}

beforeEach(() => {
	vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321/");
	vi.spyOn(crypto, "randomUUID").mockReturnValue(NEW_UUID);
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

describe("detectAvatarType", () => {
	it("recognises PNG, JPEG and WebP from their first bytes", () => {
		expect(detectAvatarType(new Uint8Array(PNG))).toBe("png");
		expect(detectAvatarType(new Uint8Array(JPEG))).toBe("jpg");
		expect(detectAvatarType(new Uint8Array(WEBP))).toBe("webp");
	});

	it("rejects other formats and truncated files", () => {
		expect(detectAvatarType(new Uint8Array(GIF))).toBeNull();
		expect(detectAvatarType(new Uint8Array([0x52, 0x49, 0x46, 0x46]))).toBeNull();
		expect(detectAvatarType(new Uint8Array([]))).toBeNull();
	});
});

describe("avatar paths", () => {
	it("builds the public URL from the stored path", () => {
		expect(getAvatarUrl(OLD_PATH)).toBe(
			`http://127.0.0.1:54321/storage/v1/object/public/avatars/${OLD_PATH}`,
		);
		expect(getAvatarUrl(null)).toBeNull();
	});

	it("only treats files directly in the user's folder as theirs", () => {
		expect(isOwnAvatarPath(OLD_PATH, USER_ID)).toBe(true);
		expect(isOwnAvatarPath(`other/${NEW_UUID}.png`, USER_ID)).toBe(false);
		expect(isOwnAvatarPath(`${USER_ID}/nested/${NEW_UUID}.png`, USER_ID)).toBe(false);
	});
});

describe("uploadOwnAvatar", () => {
	it("uploads under a new name, saves the path and removes the old file", async () => {
		const stub = createSupabaseStub({
			"profiles.select": { data: { avatar_url: OLD_PATH } },
			"storage.avatars.upload": { data: { path: "ignored" } },
			"profiles.update": {},
			"storage.avatars.remove": { data: [] },
		});

		const result = await uploadOwnAvatar(stub.client, USER_ID, image(WEBP, "image/png"));
		const newPath = `${USER_ID}/${NEW_UUID}.webp`;

		expect(result).toEqual({
			data: {
				avatarPath: newPath,
				avatarUrl: `http://127.0.0.1:54321/storage/v1/object/public/avatars/${newPath}`,
			},
		});
		const [uploadPath, , uploadOptions] = stub.callsFor("storage.avatars.upload")[0]
			.payload as [string, Uint8Array, Record<string, unknown>];
		expect(uploadPath).toBe(newPath);
		// The detected type wins over the browser-supplied one.
		expect(uploadOptions).toMatchObject({ contentType: "image/webp", upsert: false });
		expect(stub.callsFor("profiles.update")[0].payload).toEqual({ avatar_url: newPath });
		expect(stub.callsFor("storage.avatars.remove")[0].payload).toEqual([[OLD_PATH]]);
	});

	it("does not try to remove a previous file when there is none", async () => {
		const stub = createSupabaseStub({
			"profiles.select": { data: { avatar_url: null } },
			"storage.avatars.upload": { data: {} },
			"profiles.update": {},
		});

		expect(await uploadOwnAvatar(stub.client, USER_ID, image(PNG))).toHaveProperty("data");
		expect(stub.callKeys()).not.toContain("storage.avatars.remove");
	});

	it("rejects empty, oversized and non-image files before any call", async () => {
		const stub = createSupabaseStub();

		expect(await uploadOwnAvatar(stub.client, USER_ID, image([]))).toMatchObject({ status: 400 });
		expect(
			await uploadOwnAvatar(stub.client, USER_ID, new Blob([new Uint8Array(MAX_AVATAR_BYTES + 1)])),
		).toMatchObject({ status: 413 });
		expect(await uploadOwnAvatar(stub.client, USER_ID, image(GIF, "image/png"))).toMatchObject({
			status: 415,
		});
		expect(stub.callKeys()).toEqual([]);
	});

	it("does not save the path when the upload fails", async () => {
		const stub = createSupabaseStub({
			"profiles.select": { data: { avatar_url: OLD_PATH } },
			"storage.avatars.upload": { error: { message: "mime type not allowed" } },
		});

		const result = await uploadOwnAvatar(stub.client, USER_ID, image(PNG));

		expect(result).toEqual({ error: "The image could not be uploaded.", status: 400 });
		expect(stub.callKeys()).not.toContain("profiles.update");
	});

	it("removes the new file and keeps the old one when saving the path fails", async () => {
		const stub = createSupabaseStub({
			"profiles.select": { data: { avatar_url: OLD_PATH } },
			"storage.avatars.upload": { data: {} },
			"profiles.update": { error: { message: "Account unavailable.", code: "42501" } },
			"storage.avatars.remove": { data: [] },
		});

		const result = await uploadOwnAvatar(stub.client, USER_ID, image(PNG));

		expect(result).toMatchObject({ status: 400 });
		expect(stub.callsFor("storage.avatars.remove").map((call) => call.payload)).toEqual([
			[[`${USER_ID}/${NEW_UUID}.png`]],
		]);
	});

	it("reports success even if removing the old file fails", async () => {
		const stub = createSupabaseStub({
			"profiles.select": { data: { avatar_url: OLD_PATH } },
			"storage.avatars.upload": { data: {} },
			"profiles.update": {},
		});

		// No "storage.avatars.remove" response: the stub throws, like a network error.
		expect(await uploadOwnAvatar(stub.client, USER_ID, image(PNG))).toHaveProperty("data");
	});
});

describe("removeOwnAvatar", () => {
	it("clears the path and removes the file", async () => {
		const stub = createSupabaseStub({
			"profiles.select": { data: { avatar_url: OLD_PATH } },
			"profiles.update": {},
			"storage.avatars.remove": { data: [] },
		});

		expect(await removeOwnAvatar(stub.client, USER_ID)).toEqual({
			data: { avatarPath: null, avatarUrl: null },
		});
		expect(stub.callsFor("profiles.update")[0].payload).toEqual({ avatar_url: null });
		expect(stub.callsFor("storage.avatars.remove")[0].payload).toEqual([[OLD_PATH]]);
	});

	it("is a no-op when there is no picture", async () => {
		const stub = createSupabaseStub({ "profiles.select": { data: { avatar_url: null } } });

		expect(await removeOwnAvatar(stub.client, USER_ID)).toHaveProperty("data");
		expect(stub.callKeys()).toEqual(["profiles.select"]);
	});

	it("keeps the file when clearing the path fails", async () => {
		const stub = createSupabaseStub({
			"profiles.select": { data: { avatar_url: OLD_PATH } },
			"profiles.update": { error: { message: "denied" } },
		});

		expect(await removeOwnAvatar(stub.client, USER_ID)).toMatchObject({ status: 400 });
		expect(stub.callKeys()).not.toContain("storage.avatars.remove");
	});
});
