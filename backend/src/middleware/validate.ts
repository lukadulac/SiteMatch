import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";
import { sendError } from "../lib/http/respond.js";

type Source = "body" | "query" | "params";

/** Parses one part of the request; the result is in res.locals.input (req.query is read-only). */
export function validate(schema: z.ZodType, source: Source = "body") {
	return (req: Request, res: Response, next: NextFunction) => {
		const parsed = schema.safeParse(req[source]);

		if (!parsed.success) {
			sendError(res, 400, "Validation failed.", parsed.error.flatten().fieldErrors);
			return;
		}

		res.locals.input = parsed.data;
		next();
	};
}
