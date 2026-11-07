import type { UserRole } from "./auth/roles.js";

/**
 * GET /api/session. Null for a signed-out visitor and for a disabled account (which the
 * backend also signs out). role is null when the user has no profile with an app role.
 */
export type SessionState = {
	user: { id: string };
	role: UserRole | null;
} | null;

/** POST /api/session/bootstrap: the profile exists (created if needed) and has this role. */
export type SessionBootstrap = { role: UserRole };
