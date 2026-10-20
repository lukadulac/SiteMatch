import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Avatar, getInitials } from "@/components/profile/avatar";
import { setAvatarFormField } from "@/lib/profiles/avatar";

const PATH = "00000000-0000-4000-8000-00000000a001/11111111-1111-4111-8111-111111111111.webp";

beforeEach(() => {
	vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
});

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("getInitials", () => {
	it("uses the first letters of the first two names", () => {
		expect(getInitials("Ana Petrović Jovanović")).toBe("AP");
		expect(getInitials("  elena   rostova ")).toBe("ER");
		expect(getInitials("Željko")).toBe("Ž");
	});

	it("is empty when there is no name", () => {
		expect(getInitials("")).toBe("");
		expect(getInitials(null)).toBe("");
	});
});

describe("Avatar", () => {
	it("shows the stored picture from the avatars bucket", () => {
		const html = renderToStaticMarkup(createElement(Avatar, { name: "Ana Petrovic", avatarPath: PATH }));

		expect(html).toContain(`src="http://127.0.0.1:54321/storage/v1/object/public/avatars/${PATH}"`);
		expect(html).not.toContain("AP");
	});

	it("prefers a local preview over the stored picture", () => {
		const html = renderToStaticMarkup(
			createElement(Avatar, { name: "Ana", avatarPath: PATH, src: "blob:http://localhost/preview" }),
		);

		expect(html).toContain('src="blob:http://localhost/preview"');
	});

	it("falls back to initials, then to an icon", () => {
		expect(renderToStaticMarkup(createElement(Avatar, { name: "Ana Petrovic" }))).toContain(">AP<");

		const anonymous = renderToStaticMarkup(createElement(Avatar, { name: null }));
		expect(anonymous).toContain("<svg");
	});
});

describe("setAvatarFormField", () => {
	it("adds the picture with a name matching its type", () => {
		const webp = setAvatarFormField(new FormData(), new Blob(["x"], { type: "image/webp" }));
		const jpeg = setAvatarFormField(new FormData(), new Blob(["x"], { type: "image/jpeg" }));

		expect((webp.get("avatar") as File).name).toBe("avatar.webp");
		expect((jpeg.get("avatar") as File).name).toBe("avatar.jpg");
	});

	it("drops an empty file input when no picture was picked", () => {
		const form = new FormData();
		form.set("avatar", new Blob([]), "");

		expect(setAvatarFormField(form, null).has("avatar")).toBe(false);
	});
});
