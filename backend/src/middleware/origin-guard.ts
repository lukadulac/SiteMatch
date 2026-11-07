import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { sendError } from "../lib/http/respond.js";
import { hasInternalSecret } from "./require-internal.js";

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

// Behind the frontend's rewrite, req.url and Host name the backend, so a same-origin check
// against them cannot work. Writes need a listed Origin or the internal secret instead.
export function originGuard(req: Request, res: Response, next: NextFunction) {
	if (!WRITE_METHODS.has(req.method)) {
		next();
		return;
	}

	const origin = req.get("origin");

	if ((origin && env.FRONTEND_ORIGINS.includes(origin)) || hasInternalSecret(req)) {
		next();
		return;
	}

	sendError(res, 403, "Invalid request origin.");
}
