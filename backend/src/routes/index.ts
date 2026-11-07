import { Router } from "express";
import { diagRouter } from "./diag.js";

/** Mounted at /api. One router per domain is added here as each one moves. */
export const apiRouter = Router();

apiRouter.use("/_diag", diagRouter);

/** Mounted at /auth: the email confirmation and recovery callbacks (EB3). */
export const authCallbackRouter = Router();
