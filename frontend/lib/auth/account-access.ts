// TEMPORARY COPY: the backend's backend/src/modules/auth/account-access.ts is the source. Delete this file when its
// last frontend caller moves (EB3); listed in scripts/check-boundaries.mjs.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/contracts/supabase";

export async function isAccountEnabled(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase.rpc("is_account_enabled", { target_user_id: userId });
  return !error && data === true;
}
