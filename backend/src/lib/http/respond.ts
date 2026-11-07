import type { Response } from "express";

export type FieldErrors = Record<string, string[] | undefined>;

export function sendData(res: Response, data: unknown, status = 200, message?: string) {
	res.status(status).json(message === undefined ? { data } : { data, message });
}

export function sendError(res: Response, status: number, error: string, fieldErrors?: FieldErrors) {
	res.status(status).json(fieldErrors === undefined ? { error } : { error, fieldErrors });
}
