const APP_ORIGIN = "https://workbridge.local";

function isLoginPath(pathname: string) {
	const normalized = pathname.toLowerCase().replace(/\/+$/, "") || "/";

	return normalized === "/login";
}

export function getSafeReturnPath(value: unknown): string | null {
	if (typeof value !== "string") {
		return null;
	}

	const candidate = value.trim();

	if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
		return null;
	}

	if (/[\u0000-\u001F\u007F\\]/.test(candidate)) {
		return null;
	}

	let decoded: string;

	try {
		decoded = decodeURIComponent(candidate);
	} catch {
		return null;
	}

	if (
		!decoded.startsWith("/") ||
		decoded.startsWith("//") ||
		/[\u0000-\u001F\u007F\\]/.test(decoded)
	) {
		return null;
	}

	let url: URL;

	try {
		url = new URL(candidate, APP_ORIGIN);
	} catch {
		return null;
	}

	if (url.origin !== APP_ORIGIN || isLoginPath(url.pathname)) {
		return null;
	}

	return `${url.pathname}${url.search}${url.hash}`;
}

export function getLoginHref(nextPath: string | null | undefined) {
	const safeNextPath = getSafeReturnPath(nextPath);

	if (!safeNextPath) {
		return "/login";
	}

	return `/login?next=${encodeURIComponent(safeNextPath)}`;
}
