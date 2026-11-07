import type { Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
	createServerClient,
	parseCookieHeader,
	serializeCookieHeader,
	type CookieMethodsServer,
} from "@supabase/ssr";
import { env } from "../../config/env.js";
import type { Database } from "../../types/supabase.js";

export type RequestSupabaseClient = SupabaseClient<Database>;

export function createCookieMethods(req: Request, res: Response): CookieMethodsServer {
	return {
		getAll() {
			return parseCookieHeader(req.headers.cookie ?? "").map(({ name, value }) => ({
				name,
				value: value ?? "",
			}));
		},
		setAll(cookiesToSet, headers) {
			if (res.headersSent) {
				return; // A handler must await auth work before it responds.
			}
			for (const { name, value, options } of cookiesToSet) {
				res.appendHeader("Set-Cookie", serializeCookieHeader(name, value, options));
			}
			for (const [key, value] of Object.entries(headers ?? {})) {
				res.setHeader(key, value);
			}
		},
	};
}

/** One client per request, acting as the signed-in user, so RLS and auth.uid() apply. */
export function createRequestClient(req: Request, res: Response): RequestSupabaseClient {
	const client = createServerClient<Database>(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
		cookies: createCookieMethods(req, res),
	});

	// @supabase/ssr is typed against the CommonJS build of supabase-js and this project imports
	// the ES module build, so TypeScript sees two SupabaseClient classes. Only the type differs:
	// the object is the one @supabase/ssr created.
	return client as unknown as RequestSupabaseClient;
}
