import { cache } from "react";
import { api } from "@/lib/api/server";
import type { HeaderState } from "@/lib/contracts/navigation/header";

/**
 * The signed-in visitor for this request. Cached so the layout's header and a page
 * that also needs the user (the homepage) share one backend call.
 */
export const getCurrentHeaderState = cache(async (): Promise<HeaderState> => {
	const result = await api<HeaderState>("/api/me/header");

	// If the backend is down the header shows the signed-out state; guarded pages get a 503.
	return result.ok ? result.data : { user: null };
});
