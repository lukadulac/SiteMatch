import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

export async function isAccountEnabled(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase.rpc("is_account_enabled", { target_user_id: userId });
  return !error && data === true;
}
