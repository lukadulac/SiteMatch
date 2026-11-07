// Builds @supabase/ssr session cookies the way the library writes them: base64url-encoded
// JSON with a "base64-" prefix, split into chunks named <key>.0, <key>.1, …
export const AUTH_COOKIE = "sb-testproject-auth-token"; // From SUPABASE_URL in vitest.config.ts.

const CHUNK_SIZE = 3180; // MAX_CHUNK_SIZE in @supabase/ssr.

function fakeJwt(payload: Record<string, unknown>) {
	const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
	return `${part({ alg: "HS256", typ: "JWT" })}.${part(payload)}.signature`;
}

export function fakeSession(userId: string, expiresAt: number, metadataBytes = 0) {
	return {
		access_token: fakeJwt({ sub: userId, exp: expiresAt, role: "authenticated" }),
		refresh_token: `refresh-${userId}`,
		token_type: "bearer",
		expires_in: 3600,
		expires_at: expiresAt,
		user: {
			id: userId,
			aud: "authenticated",
			role: "authenticated",
			email: `${userId}@example.test`,
			app_metadata: {},
			// Padding makes the session large enough to need several cookie chunks.
			user_metadata: { padding: "x".repeat(metadataBytes) },
			created_at: "2026-01-01T00:00:00Z",
		},
	};
}

export function sessionCookieHeader(session: unknown) {
	const value = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
	const chunks: string[] = [];

	for (let index = 0; index < value.length; index += CHUNK_SIZE) {
		chunks.push(value.slice(index, index + CHUNK_SIZE));
	}

	return chunks.map((chunk, index) => `${AUTH_COOKIE}.${index}=${chunk}`).join("; ");
}
