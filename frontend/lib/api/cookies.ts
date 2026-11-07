import { cookies } from "next/headers";

export type ParsedSetCookie = {
	name: string;
	value: string;
	options: {
		path?: string;
		domain?: string;
		maxAge?: number;
		expires?: Date;
		httpOnly?: boolean;
		secure?: boolean;
		sameSite?: "lax" | "strict" | "none";
	};
};

/** Parses one Set-Cookie line from the backend. The value is decoded once. */
export function parseSetCookie(line: string): ParsedSetCookie | null {
	const [pair, ...attributes] = line.split(";");
	const separator = pair.indexOf("=");

	if (separator <= 0) {
		return null;
	}

	const name = pair.slice(0, separator).trim();
	const rawValue = pair.slice(separator + 1).trim();
	let value: string;

	try {
		// The backend URL-encodes values; Next.js encodes again when it writes, so decode once.
		value = decodeURIComponent(rawValue);
	} catch {
		value = rawValue;
	}

	const options: ParsedSetCookie["options"] = {};

	for (const attribute of attributes) {
		const [rawKey, ...rest] = attribute.split("=");
		const key = rawKey.trim().toLowerCase();
		const attributeValue = rest.join("=").trim();

		if (key === "path") options.path = attributeValue;
		else if (key === "domain") options.domain = attributeValue;
		else if (key === "max-age" && Number.isFinite(Number(attributeValue))) options.maxAge = Number(attributeValue);
		else if (key === "expires" && !Number.isNaN(Date.parse(attributeValue))) options.expires = new Date(attributeValue);
		else if (key === "httponly") options.httpOnly = true;
		else if (key === "secure") options.secure = true;
		else if (key === "samesite") {
			const sameSite = attributeValue.toLowerCase();
			if (sameSite === "lax" || sameSite === "strict" || sameSite === "none") options.sameSite = sameSite;
		}
	}

	return { name, value, options };
}

/** A cookie the backend is clearing (signOut sends an empty value with Max-Age=0). */
export function isCookieRemoval(cookie: ParsedSetCookie) {
	return cookie.options.maxAge === 0 || (cookie.options.expires?.getTime() ?? Infinity) <= Date.now();
}

/**
 * Stores the backend's Set-Cookie lines in the browser through cookies(). Works in Server
 * Actions and Route Handlers. A Server Component cannot write cookies; there the call is a
 * no-op, and proxy.ts has already refreshed the session for this request.
 */
export async function applySetCookies(lines: string[]) {
	if (lines.length === 0) {
		return;
	}

	const cookieStore = await cookies();

	try {
		for (const cookie of lines.map(parseSetCookie)) {
			if (cookie) {
				cookieStore.set(cookie.name, cookie.value, cookie.options);
			}
		}
	} catch {
		// Server Component render: cookies are read-only.
	}
}
