// GENERATED from backend/src/contracts/auth/cookie-name.ts by scripts/sync-contracts.mjs. Do not edit;
// change the backend file and run npm run contracts:sync.
/**
 * The cookie @supabase/ssr keeps the session in: sb-<first label of the Supabase host>-auth-token,
 * the same default storage key supabase-js uses. Backend and frontend must agree on it, so both
 * must use exactly the same Supabase URL.
 */
export function getAuthCookieName(supabaseUrl: string) {
	return `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
}
