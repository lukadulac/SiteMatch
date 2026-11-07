import { cache } from "react";
import { getHeaderState } from "@/lib/navigation/header-state";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The signed-in visitor for this request. Cached so the layout's header and a page
 * that also needs the user (the homepage) share one set of queries.
 */
export const getCurrentHeaderState = cache(async () =>
	getHeaderState(await createSupabaseServerClient()),
);
