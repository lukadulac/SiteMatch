"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/supabase";

let browserClient: SupabaseClient<Database> | undefined;

export function createSupabaseBrowserClient() {
  if (browserClient) {
    return browserClient;
  }

  const { url, anonKey } = getSupabaseEnv();

  browserClient = createBrowserClient<Database>(url, anonKey);

  return browserClient;
}

export async function authenticateSupabaseRealtime(
  supabase = createSupabaseBrowserClient(),
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    supabase.realtime.setAuth(session.access_token);
  }

  return session?.access_token ?? null;
}
