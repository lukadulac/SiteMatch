import type { Request, Response } from "express";
import { sendError } from "../lib/http/respond.js";

export function notFound(_req: Request, res: Response) {
	sendError(res, 404, "Not found.");
}
