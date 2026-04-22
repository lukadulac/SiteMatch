import { redirect } from "next/navigation";
import { resolvePostAuthPath } from "@/lib/auth/profile-completion";
import { isAppRole } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !isAppRole(profile.role)) {
    redirect("/login");
  }

  const resolved = await resolvePostAuthPath(supabase, user.id, profile.role);
  redirect(resolved.path);
}
