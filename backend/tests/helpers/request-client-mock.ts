import type { SupabaseStub } from "./supabase-stub.js";

/**
 * Route tests swap the per-request Supabase client for a stub:
 *
 *   const supabase = vi.hoisted(() => ({ stub: null as SupabaseStub | null }));
 *   vi.mock("../../src/lib/supabase/request-client.js", () => requestClientMock(supabase));
 */
export function requestClientMock(holder: { stub: SupabaseStub | null }) {
	return {
		createRequestClient: () => {
			if (!holder.stub) {
				throw new Error("Set the Supabase stub before the request.");
			}

			return holder.stub.client;
		},
	};
}

export const INTERNAL_SECRET = "test-internal-secret-0123456789abcdef";
