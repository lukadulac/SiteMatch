import { Router } from "express";
import { env } from "../config/env.js";
import { getAuthCookieName } from "../contracts/auth/cookie-name.js";
import { sendData, sendError } from "../lib/http/respond.js";
import { optionalAuth, requireAuth } from "../middleware/require-auth.js";
import { requireInternal } from "../middleware/require-internal.js";
import { ensureUserProfile } from "../modules/auth/provision.js";
import { getSessionState } from "../modules/auth/session.js";

export const sessionRouter = Router();

// Called by proxy.ts on page navigations. Refreshing an expired token happens here, and the
// proxy copies the new cookies to the browser and to the rest of the request.
sessionRouter.get("/", requireInternal, optionalAuth, async (_req, res) => {
	// The proxy compares this with its own: a mismatch means the two Supabase URLs differ.
	res.setHeader("x-auth-cookie", getAuthCookieName(env.SUPABASE_URL));
	sendData(res, await getSessionState(res.locals.supabase, res.locals.user ?? null));
});

// Replaces getUser + ensureUserProfile at the top of pages.
sessionRouter.post("/bootstrap", requireInternal, requireAuth, async (_req, res) => {
	const supabase = res.locals.supabase;
	const provisioned = await ensureUserProfile(supabase, res.locals.user!);

	if (!provisioned.role) {
		await supabase.auth.signOut();
		sendError(res, 401, "Unauthorized.");
		return;
	}

	sendData(res, { role: provisioned.role });
});
