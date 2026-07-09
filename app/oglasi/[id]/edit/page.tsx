import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ClientProjectForm,
  type ClientProjectFormInitialValues,
} from "@/components/projects/client-project-form";
import { ensureUserProfile } from "@/lib/auth/provision";
import { isClientProfileComplete } from "@/lib/auth/profile-completion";
import { getDashboardPath } from "@/lib/auth/roles";
import { getProjectFormMeta } from "@/lib/projects/queries";
import { getClientProjectById } from "@/lib/projects/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditListingPage({ params }: PageProps) {
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

  const { id } = await params;

  const [metaResult, clientProfileResult, projectResult] = await Promise.all([
    getProjectFormMeta(supabase),
    supabase
      .from("client_profiles")
      .select(
        "business_name, business_type, business_type_text, project_idea, interested_solution_types, interested_solution_other_text",
      )
      .eq("user_id", user.id)
      .maybeSingle(),
    getClientProjectById(supabase, user.id, id),
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

  if (projectResult.error) {
    throw new Error(projectResult.error);
  }

  if (!projectResult.data) {
    throw new Error("Project could not be loaded.");
  }

  const project = projectResult.data;
  const initialValues: ClientProjectFormInitialValues = {
    id: project.id,
    title: project.title,
    description: project.description,
    service_type_id: project.service_type_id ?? "",
    business_domain_id: project.business_domain_id,
    business_domain_other_text: project.business_domain_other_text,
    business_context_text: project.business_context_text,
    what_do_you_need_text: project.what_do_you_need_text ?? "",
    goal_other_text: project.goal_other_text,
    budget_type: project.budget_type,
    budget_min: project.budget_min,
    budget_max: project.budget_max,
    deadline_type: project.deadline_type,
    deadline_date: project.deadline_date,
    desired_start_date: project.desired_start_date,
    has_existing_website: project.has_existing_website,
    existing_website_url: project.existing_website_url,
    needs_design: project.needs_design,
    needs_seo: project.needs_seo,
    needs_content_writing: project.needs_content_writing,
    is_remote_friendly: project.is_remote_friendly,
    preferred_language: project.preferred_language,
    preferred_provider_type: project.preferred_provider_type,
    goal_ids: project.goal_ids,
    feature_ids: project.feature_ids,
    status: project.status,
  };

  const profileComplete = isClientProfileComplete(clientProfileResult.data);

  return (
    <section className="space-y-6 py-4 sm:py-8">
      <div className="flex flex-wrap items-center gap-3 text-sm text-secondary">
        <Link href="/oglasi" className="font-semibold text-black transition hover:opacity-70">
          Client listings
        </Link>
        <span>/</span>
        <Link href={`/oglasi/${project.id}`} className="font-semibold text-black transition hover:opacity-70">
          {project.title}
        </Link>
        <span>/</span>
        <span>Edit listing</span>
      </div>

      <ClientProjectForm
        meta={metaResult.data}
        profileComplete={profileComplete}
        mode="edit"
        projectId={project.id}
        initialValues={initialValues}
      />
    </section>
  );
}
