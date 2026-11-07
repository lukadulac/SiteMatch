import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { originGuard } from "./middleware/origin-guard.js";
import { sessionClient } from "./middleware/session.js";
import { notFound } from "./middleware/not-found.js";
import { errorHandler } from "./middleware/error-handler.js";
import { apiRouter, authCallbackRouter } from "./routes/index.js";

export function createApp() {
	const app = express();
	app.disable("x-powered-by");
	app.set("trust proxy", env.TRUST_PROXY_HOPS);
	app.use(helmet());
	app.get("/health", (_req, res) => { res.json({ ok: true }); });
	// Responses can carry session cookies, so no shared cache may ever store one.
	app.use((_req, res, next) => { res.setHeader("Cache-Control", "private, no-store"); next(); });
	app.use(originGuard);
	app.use(sessionClient);
	app.use("/auth", authCallbackRouter);
	app.use("/api", apiRouter);
	app.use(notFound);
	app.use(errorHandler);
	return app;
}

export default createApp();
