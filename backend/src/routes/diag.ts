import { Router } from "express";
import { env } from "../config/env.js";
import { sendData } from "../lib/http/respond.js";

// TEMPORARY (EB1): proves what survives the frontend's rewrite on Vercel. Remove after EB1.
export const diagRouter = Router();

diagRouter.get("/", (req, res) => {
	const cookieHeader = req.headers.cookie ?? "";

	sendData(res, {
		origin: req.get("origin") ?? null,
		host: req.get("host") ?? null,
		xForwardedHost: req.get("x-forwarded-host") ?? null,
		xForwardedFor: req.get("x-forwarded-for") ?? null,
		ip: req.ip ?? null,
		cookieCount: cookieHeader ? cookieHeader.split(";").length : 0,
		cookieHeaderBytes: Buffer.byteLength(cookieHeader),
	});
});

diagRouter.post("/", (req, res) => {
	const options = {
		httpOnly: true,
		sameSite: "lax" as const,
		secure: env.SITE_URL.startsWith("https:"),
		path: "/",
		maxAge: 5 * 60 * 1000,
	};

	res.cookie("wb_diag_a", "1", options);
	res.cookie("wb_diag_b", "2", options);
	sendData(res, { origin: req.get("origin") ?? null }, 200, "Set 2 test cookies.");
});
