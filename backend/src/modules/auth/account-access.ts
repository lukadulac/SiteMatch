// Moved from frontend/lib/auth/account-access.ts (isAccountEnabled). Until EB3 the frontend keeps a temporary copy for
// callers that have not moved yet; see TEMPORARY_COPIES in scripts/check-boundaries.mjs.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/supabase.js";

export async function isAccountEnabled(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase.rpc("is_account_enabled", { target_user_id: userId });
  return !error && data === true;
}
