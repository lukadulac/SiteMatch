import { Router } from "express";
import { sendData } from "../lib/http/respond.js";
import { requireInternal } from "../middleware/require-internal.js";
import { getHeaderState } from "../modules/navigation/header-state.js";

export const meRouter = Router();

// getHeaderState reads the user itself, and returns { user: null } for a signed-out visitor.
meRouter.get("/header", requireInternal, async (_req, res) => {
	sendData(res, await getHeaderState(res.locals.supabase));
});
