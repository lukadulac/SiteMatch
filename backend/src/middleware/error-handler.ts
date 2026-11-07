import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { sendError } from "../lib/http/respond.js";
import { logger } from "../lib/logger.js";

type HttpError = Error & { status?: number; type?: string };

// Express recognises an error handler by its four parameters.
export function errorHandler(error: HttpError, req: Request, res: Response, _next: NextFunction) {
	// Errors from express.json(): the client sent a bad body, not a server fault.
	if (error.type === "entity.parse.failed") {
		sendError(res, 400, "Invalid JSON.");
		return;
	}

	if (error.type === "entity.too.large") {
		sendError(res, 413, "The request is too large.");
		return;
	}

	const requestId = randomUUID();

	logger.error("Unhandled request error", {
		requestId,
		method: req.method,
		path: req.path,
		ip: req.ip,
		error,
	});

	if (res.headersSent) {
		res.end();
		return;
	}

	// Never a stack or a raw database message.
	res.setHeader("x-request-id", requestId);
	sendError(res, 500, "Something went wrong.");
}
