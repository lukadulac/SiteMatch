import { Router } from "express";
import { diagRouter } from "./diag.js";
import { meRouter } from "./me.js";
import { sessionRouter } from "./session.js";

/** Mounted at /api. One router per domain is added here as each one moves. */
export const apiRouter = Router();

apiRouter.use("/_diag", diagRouter);
apiRouter.use("/session", sessionRouter);
apiRouter.use("/me", meRouter);

/** Mounted at /auth: the email confirmation and recovery callbacks (EB3). */
export const authCallbackRouter = Router();
