/**
 * The Content-Security-Policy for every page. Scripts run only with this request's
 * nonce ('strict-dynamic' lets those scripts load Next's chunks), so injected markup
 * cannot run code. Styles allow 'unsafe-inline' because React renders style attributes,
 * which a nonce cannot cover; style injection cannot run code.
 */
export function buildContentSecurityPolicy(
	nonce: string,
	{ supabaseUrl, isDev }: { supabaseUrl?: string; isDev: boolean },
) {
	const supabase = supabaseOrigins(supabaseUrl);
	const directives = [
		"default-src 'self'",
		`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
		"style-src 'self' 'unsafe-inline'",
		`img-src 'self' blob: data:${supabase.http ? ` ${supabase.http}` : ""}`,
		"font-src 'self'",
		`connect-src 'self'${supabase.http ? ` ${supabase.http} ${supabase.ws}` : ""}${isDev ? " ws:" : ""}`,
		"manifest-src 'self'",
		"worker-src 'self' blob:",
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'",
		"frame-ancestors 'none'",
		...(isDev ? [] : ["upgrade-insecure-requests"]),
	];

	return directives.join("; ");
}

/** Avatars load from Supabase Storage and the browser client talks to its API and Realtime. */
function supabaseOrigins(supabaseUrl: string | undefined) {
	if (!supabaseUrl) {
		return { http: null, ws: null };
	}

	try {
		const url = new URL(supabaseUrl);
		const ws = `${url.protocol === "https:" ? "wss:" : "ws:"}//${url.host}`;

		return { http: url.origin, ws };
	} catch {
		return { http: null, ws: null };
	}
}

export function createNonce() {
	return btoa(crypto.randomUUID());
}
