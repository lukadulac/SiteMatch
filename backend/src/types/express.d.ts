import type { User } from "@supabase/supabase-js";
import type { RequestSupabaseClient } from "../lib/supabase/request-client.js";

declare global {
	namespace Express {
		interface Locals {
			/** Set by sessionClient on every request. */
			supabase: RequestSupabaseClient;
			/** Set by requireAuth (always a user) or optionalAuth (null when signed out). */
			user?: User | null;
			/** Parsed input from validate(schema). */
			input?: unknown;
		}
	}
}

export {};
