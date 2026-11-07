import type { NextFunction, Request, Response } from "express";
import { sendError } from "../lib/http/respond.js";

async function readUser(res: Response) {
	// getUser, not getSession: it asks Supabase Auth, as the Next.js handlers do today.
	const {
		data: { user },
	} = await res.locals.supabase.auth.getUser();

	return user;
}

export async function requireAuth(_req: Request, res: Response, next: NextFunction) {
	const user = await readUser(res);

	if (!user) {
		sendError(res, 401, "Unauthorized.");
		return;
	}

	res.locals.user = user;
	next();
}

/** For public routes that personalise: res.locals.user is null for a signed-out visitor. */
export async function optionalAuth(_req: Request, res: Response, next: NextFunction) {
	res.locals.user = await readUser(res);
	next();
}
