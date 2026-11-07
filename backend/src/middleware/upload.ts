import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { sendError } from "../lib/http/respond.js";

/**
 * One file field, held in memory. Content checks (magic bytes) stay with the feature's own
 * validation, such as validateAvatarFile.
 */
export function upload(maxBytes: number, field = "file") {
	const parse = multer({
		storage: multer.memoryStorage(),
		limits: { fileSize: maxBytes, files: 1 },
	}).single(field);

	return (req: Request, res: Response, next: NextFunction) => {
		parse(req, res, (error: unknown) => {
			if (error instanceof multer.MulterError) {
				sendError(
					res,
					error.code === "LIMIT_FILE_SIZE" ? 413 : 400,
					error.code === "LIMIT_FILE_SIZE" ? "The file is too large." : "Invalid upload.",
				);
				return;
			}

			next(error);
		});
	};
}
