import type { NextFunction, Request, Response } from "express";
import { createRequestClient } from "../lib/supabase/request-client.js";

/** Creates the per-request Supabase client. No network call. */
export function sessionClient(req: Request, res: Response, next: NextFunction) {
	res.locals.supabase = createRequestClient(req, res);
	next();
}
