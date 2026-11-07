import { createHash, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { sendError } from "../lib/http/respond.js";

function digest(value: string) {
	// Equal-length digests, so the comparison does not reveal the secret's length.
	return createHash("sha256").update(value).digest();
}

export function hasInternalSecret(req: Request) {
	const received = req.get("x-internal-secret");

	if (!received) {
		return false;
	}

	const receivedDigest = digest(received);
	let matched = false;

	for (const secret of env.INTERNAL_API_SECRET) {
		matched = timingSafeEqual(receivedDigest, digest(secret)) || matched;
	}

	return matched;
}

/** Only the frontend's server (Server Actions, Server Components, proxy.ts) may call this route. */
export function requireInternal(req: Request, res: Response, next: NextFunction) {
	if (!hasInternalSecret(req)) {
		sendError(res, 403, "Forbidden.");
		return;
	}

	next();
}
