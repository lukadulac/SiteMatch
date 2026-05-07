import type { SupabaseClient } from "@supabase/supabase-js";
import { isClientProfileComplete } from "@/lib/auth/profile-completion";
import type { CreateProjectInput } from "@/lib/projects/schemas";
import type { Database } from "@/types/supabase";

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function buildProjectSlug(title: string) {
  const base = slugify(title) || "project";
  const suffix = crypto.randomUUID().slice(0, 8);
  return `${base}-${suffix}`;
}

type CreateProjectResult =
  | {
      data: {
        id: string;
        slug: string;
        status: Database["public"]["Enums"]["project_status"];
      };
      error?: never;
    }
  | {
      data?: never;
      error: string;
    };

export async function createProject(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: CreateProjectInput,
): Promise<CreateProjectResult> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    return { error: profileError.message };
  }

  if (!profile || profile.role !== "client") {
    return { error: "Only clients can create project listings." };
  }

  const { data: clientProfile, error: clientProfileError } = await supabase
    .from("client_profiles")
    .select(
      "business_name, business_type, business_description, preferred_language",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (clientProfileError) {
    return { error: clientProfileError.message };
  }

  if (!isClientProfileComplete(clientProfile)) {
    return { error: "Complete your client profile before creating a listing." };
  }

  const slug = buildProjectSlug(input.title);

  const projectPayload: Database["public"]["Tables"]["projects"]["Insert"] = {
    title: input.title,
    description: input.description,
    client_id: userId,
    slug,
    service_type_id: input.service_type_id,
    business_domain_id: input.business_domain_id ?? null,
    business_domain_other_text: input.business_domain_other_text ?? null,
    business_context_text: input.business_context_text ?? null,
    what_do_you_need_text: input.what_do_you_need_text,
    target_audience_text: input.target_audience_text ?? null,
    success_criteria_text: input.success_criteria_text ?? null,
    budget_type: input.budget_type,
    budget_min: input.budget_min ?? null,
    budget_max: input.budget_max ?? null,
    deadline_type: input.deadline_type,
    deadline_date: input.deadline_date ?? null,
    desired_start_date: input.desired_start_date ?? null,
    readiness_level: input.readiness_level ?? null,
    scope_level: input.scope_level ?? null,
    estimated_pages: input.estimated_pages ?? null,
    has_existing_website: input.has_existing_website,
    existing_website_url: input.existing_website_url ?? null,
    needs_design: input.needs_design,
    needs_seo: input.needs_seo,
    needs_content_writing: input.needs_content_writing,
    is_remote_friendly: input.is_remote_friendly,
    preferred_language: input.preferred_language ?? null,
    preferred_provider_type: input.preferred_provider_type,
    discovery_notes: input.discovery_notes ?? null,
    goal_other_text: input.goal_other_text ?? null,
    status: input.status,
  };

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert(projectPayload)
    .select("id, slug, status")
    .single();

  if (projectError) {
    return { error: projectError.message };
  }

  if (input.goal_ids.length > 0) {
    const { error } = await supabase.from("project_request_goals").insert(
      input.goal_ids.map((goalId) => ({
        project_id: project.id,
        goal_id: goalId,
      })),
    );

    if (error) {
      return { error: error.message };
    }
  }

  if (input.feature_ids.length > 0) {
    const { error } = await supabase.from("project_request_features").insert(
      input.feature_ids.map((featureId) => ({
        project_id: project.id,
        feature_id: featureId,
      })),
    );

    if (error) {
      return { error: error.message };
    }
  }

  return { data: project };
}
