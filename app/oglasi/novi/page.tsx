import Link from "next/link";
import { redirect } from "next/navigation";
import { ClientProjectForm } from "@/components/projects/client-project-form";
import { ensureUserProfile } from "@/lib/auth/provision";
import { isClientProfileComplete } from "@/lib/auth/profile-completion";
import { getDashboardPath } from "@/lib/auth/roles";
import { getProjectFormMeta } from "@/lib/projects/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function NewListingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const provisioned = await ensureUserProfile(supabase, user);

  if (!provisioned.role) {
    await supabase.auth.signOut();
    redirect("/login");
  }

  if (provisioned.role !== "client") {
    redirect(getDashboardPath(provisioned.role));
  }

  const [metaResult, clientProfileResult] = await Promise.all([
    getProjectFormMeta(supabase),
    supabase
      .from("client_profiles")
      .select(
        "business_name, business_type, business_type_text, project_idea, interested_solution_types, interested_solution_other_text",
      )
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (metaResult.error) {
    throw new Error(metaResult.error);
  }

  if (!metaResult.data) {
    throw new Error("Project form metadata could not be loaded.");
  }

  if (clientProfileResult.error) {
    throw new Error(clientProfileResult.error.message);
  }

  const meta = metaResult.data;
  const profileComplete = isClientProfileComplete(clientProfileResult.data);

  return (
    <section className="space-y-6 py-4 sm:py-8">
      <div className="flex flex-wrap items-center gap-3 text-sm text-secondary">
        <Link href="/oglasi" className="font-semibold text-black transition hover:opacity-70">
          Client listings
        </Link>
        <span>/</span>
        <span>Create listing</span>
      </div>

      <ClientProjectForm meta={meta} profileComplete={profileComplete} />
    </section>
  );
}
