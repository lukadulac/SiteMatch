import type { SupabaseClient } from "@supabase/supabase-js";
import { isClientProfileComplete } from "@/lib/auth/profile-completion";
import { ensureConversationForAcceptedApplication } from "@/lib/messaging/service";
import type {
  CreateApplicationInput,
  CreateProjectInput,
  UpdateProjectInput,
  UpdateApplicationStatusInput,
} from "@/lib/projects/schemas";
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

type ClientProjectSummary = Pick<
  Database["public"]["Tables"]["projects"]["Row"],
  | "id"
  | "slug"
  | "title"
  | "status"
  | "description"
  | "service_type_id"
  | "budget_type"
  | "budget_min"
  | "budget_max"
  | "deadline_type"
  | "deadline_date"
  | "desired_start_date"
  | "updated_at"
  | "created_at"
>;

type ClientProjectDetail = Database["public"]["Tables"]["projects"]["Row"] & {
  goal_ids: string[];
  feature_ids: string[];
};

type ProviderProjectSummary = Pick<
  Database["public"]["Tables"]["projects"]["Row"],
  | "id"
  | "slug"
  | "title"
  | "description"
  | "status"
  | "service_type_id"
  | "budget_type"
  | "budget_min"
  | "budget_max"
  | "deadline_type"
  | "deadline_date"
  | "preferred_provider_type"
  | "scope_level"
  | "readiness_level"
  | "created_at"
  | "updated_at"
>;

type ProviderProjectDetail = Database["public"]["Tables"]["projects"]["Row"] & {
  goal_ids: string[];
  feature_ids: string[];
};

type ClientProjectApplicationSummary = Pick<
  Database["public"]["Tables"]["applications"]["Row"],
  | "id"
  | "project_id"
  | "provider_id"
  | "status"
  | "cover_message"
  | "proposed_price"
  | "estimated_delivery_days"
  | "created_at"
  | "updated_at"
> & {
  provider: Pick<
    Database["public"]["Tables"]["profiles"]["Row"],
    "id" | "full_name" | "email" | "phone" | "country" | "city"
  > | null;
};

type ClientProjectApplicationDetail =
  Database["public"]["Tables"]["applications"]["Row"] & {
    provider: Pick<
      Database["public"]["Tables"]["profiles"]["Row"],
      "id" | "full_name" | "email" | "phone" | "country" | "city"
    > | null;
    project: Pick<
      Database["public"]["Tables"]["projects"]["Row"],
      "id" | "title" | "slug" | "status" | "client_id"
    > | null;
  };

type ProjectResult<T> =
  | {
      data: T;
      error?: never;
    }
  | {
      data?: never;
      error: string;
    };

async function getClientProjectProfileState(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    return { error: profileError.message };
  }

  if (!profile || profile.role !== "client") {
    return { error: "Only clients can manage project listings." };
  }

  const { data: clientProfile, error: clientProfileError } = await supabase
    .from("client_profiles")
    .select(
      "business_name, business_type, business_type_text, project_idea, interested_solution_types, interested_solution_other_text",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (clientProfileError) {
    return { error: clientProfileError.message };
  }

  if (!isClientProfileComplete(clientProfile)) {
    return { error: "Complete your client profile before managing listings." };
  }

  return { error: undefined };
}

async function getOwnedProjectRecord(
  supabase: SupabaseClient<Database>,
  userId: string,
  projectId: string,
) {
  const { data, error } = await supabase
    .from("projects")
    .select("id, client_id, status")
    .eq("id", projectId)
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }

  if (!data || data.client_id !== userId) {
    return { error: "Project not found." };
  }

  return { data };
}

async function ensureProviderUser(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }

  if (!profile || profile.role !== "provider") {
    return { error: "Only providers can access this resource." };
  }

  return { error: undefined };
}

async function ensureClientUser(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }

  if (!profile || profile.role !== "client") {
    return { error: "Only clients can access this resource." };
  }

  return { error: undefined };
}

function buildProjectPayload(
  userId: string,
  input: CreateProjectInput | UpdateProjectInput,
  slug: string,
): Database["public"]["Tables"]["projects"]["Insert"] {
  return {
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
}

async function replaceProjectRelations(
  supabase: SupabaseClient<Database>,
  projectId: string,
  goalIds: string[],
  featureIds: string[],
) {
  const { error: deleteGoalsError } = await supabase
    .from("project_request_goals")
    .delete()
    .eq("project_id", projectId);

  if (deleteGoalsError) {
    return { error: deleteGoalsError.message };
  }

  const { error: deleteFeaturesError } = await supabase
    .from("project_request_features")
    .delete()
    .eq("project_id", projectId);

  if (deleteFeaturesError) {
    return { error: deleteFeaturesError.message };
  }

  if (goalIds.length > 0) {
    const { error } = await supabase.from("project_request_goals").insert(
      goalIds.map((goalId) => ({
        project_id: projectId,
        goal_id: goalId,
      })),
    );

    if (error) {
      return { error: error.message };
    }
  }

  if (featureIds.length > 0) {
    const { error } = await supabase.from("project_request_features").insert(
      featureIds.map((featureId) => ({
        project_id: projectId,
        feature_id: featureId,
      })),
    );

    if (error) {
      return { error: error.message };
    }
  }

  return { error: undefined };
}

export async function createProject(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: CreateProjectInput,
): Promise<CreateProjectResult> {
  const profileState = await getClientProjectProfileState(supabase, userId);

  if (profileState.error) {
    return { error: profileState.error };
  }

  const slug = buildProjectSlug(input.title);
  const projectPayload = buildProjectPayload(userId, input, slug);

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert(projectPayload)
    .select("id, slug, status")
    .single();

  if (projectError) {
    return { error: projectError.message };
  }

  const relationsResult = await replaceProjectRelations(
    supabase,
    project.id,
    input.goal_ids,
    input.feature_ids,
  );

  if (relationsResult.error) {
    return { error: relationsResult.error };
  }

  return { data: project };
}

export async function getClientProjects(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<ProjectResult<ClientProjectSummary[]>> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    return { error: profileError.message };
  }

  if (!profile || profile.role !== "client") {
    return { error: "Only clients can view their project listings." };
  }

  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, slug, title, status, description, service_type_id, budget_type, budget_min, budget_max, deadline_type, deadline_date, desired_start_date, updated_at, created_at",
    )
    .eq("client_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    return { error: error.message };
  }

  return { data: data ?? [] };
}

export async function getClientProjectById(
  supabase: SupabaseClient<Database>,
  userId: string,
  projectId: string,
): Promise<ProjectResult<ClientProjectDetail>> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    return { error: profileError.message };
  }

  if (!profile || profile.role !== "client") {
    return { error: "Only clients can view their project listings." };
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("client_id", userId)
    .maybeSingle();

  if (projectError) {
    return { error: projectError.message };
  }

  if (!project) {
    return { error: "Project not found." };
  }

  const [{ data: goals, error: goalsError }, { data: features, error: featuresError }] =
    await Promise.all([
      supabase
        .from("project_request_goals")
        .select("goal_id")
        .eq("project_id", projectId),
      supabase
        .from("project_request_features")
        .select("feature_id")
        .eq("project_id", projectId),
    ]);

  if (goalsError) {
    return { error: goalsError.message };
  }

  if (featuresError) {
    return { error: featuresError.message };
  }

  return {
    data: {
      ...project,
      goal_ids: (goals ?? []).map((item) => item.goal_id),
      feature_ids: (features ?? []).map((item) => item.feature_id),
    },
  };
}

export async function updateClientProject(
  supabase: SupabaseClient<Database>,
  userId: string,
  projectId: string,
  input: UpdateProjectInput,
): Promise<ProjectResult<{ id: string; slug: string; status: Database["public"]["Enums"]["project_status"] }>> {
  const profileState = await getClientProjectProfileState(supabase, userId);

  if (profileState.error) {
    return { error: profileState.error };
  }

  const ownedProject = await getOwnedProjectRecord(supabase, userId, projectId);

  if (ownedProject.error) {
    return { error: ownedProject.error };
  }

  const project = ownedProject.data;

  if (
    !project ||
    (project.status !== "draft" && project.status !== "published")
  ) {
    return { error: "Only draft or published projects can be updated." };
  }

  const projectPayload: Database["public"]["Tables"]["projects"]["Update"] = {
    ...buildProjectPayload(userId, input, project.id),
    client_id: undefined,
    slug: undefined,
  };

  const { data: updatedProject, error: updateError } = await supabase
    .from("projects")
    .update(projectPayload)
    .eq("id", projectId)
    .eq("client_id", userId)
    .select("id, slug, status")
    .single();

  if (updateError) {
    return { error: updateError.message };
  }

  const relationsResult = await replaceProjectRelations(
    supabase,
    projectId,
    input.goal_ids,
    input.feature_ids,
  );

  if (relationsResult.error) {
    return { error: relationsResult.error };
  }

  return { data: updatedProject };
}

export async function getPublishedProjectsForProviders(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<ProjectResult<ProviderProjectSummary[]>> {
  const providerState = await ensureProviderUser(supabase, userId);

  if (providerState.error) {
    return { error: providerState.error };
  }

  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, slug, title, description, status, service_type_id, budget_type, budget_min, budget_max, deadline_type, deadline_date, preferred_provider_type, scope_level, readiness_level, created_at, updated_at",
    )
    .eq("status", "published")
    .order("updated_at", { ascending: false });

  if (error) {
    return { error: error.message };
  }

  return { data: data ?? [] };
}

export async function getPublishedProjectByIdForProvider(
  supabase: SupabaseClient<Database>,
  userId: string,
  projectId: string,
): Promise<ProjectResult<ProviderProjectDetail>> {
  const providerState = await ensureProviderUser(supabase, userId);

  if (providerState.error) {
    return { error: providerState.error };
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("status", "published")
    .maybeSingle();

  if (projectError) {
    return { error: projectError.message };
  }

  if (!project) {
    return { error: "Project not found." };
  }

  const [{ data: goals, error: goalsError }, { data: features, error: featuresError }] =
    await Promise.all([
      supabase
        .from("project_request_goals")
        .select("goal_id")
        .eq("project_id", projectId),
      supabase
        .from("project_request_features")
        .select("feature_id")
        .eq("project_id", projectId),
    ]);

  if (goalsError) {
    return { error: goalsError.message };
  }

  if (featuresError) {
    return { error: featuresError.message };
  }

  return {
    data: {
      ...project,
      goal_ids: (goals ?? []).map((item) => item.goal_id),
      feature_ids: (features ?? []).map((item) => item.feature_id),
    },
  };
}

export async function createProjectApplication(
  supabase: SupabaseClient<Database>,
  userId: string,
  projectId: string,
  input: CreateApplicationInput,
): Promise<ProjectResult<{ id: string; status: Database["public"]["Enums"]["application_status"] }>> {
  const providerState = await ensureProviderUser(supabase, userId);

  if (providerState.error) {
    return { error: providerState.error };
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, client_id, status")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    return { error: projectError.message };
  }

  if (!project || project.status !== "published") {
    return { error: "Project not found." };
  }

  if (project.client_id === userId) {
    return { error: "Providers cannot apply to their own project." };
  }

  const { data: existingApplication, error: existingApplicationError } = await supabase
    .from("applications")
    .select("id")
    .eq("project_id", projectId)
    .eq("provider_id", userId)
    .maybeSingle();

  if (existingApplicationError) {
    return { error: existingApplicationError.message };
  }

  if (existingApplication) {
    return { error: "You have already applied to this project." };
  }

  const { data, error } = await supabase
    .from("applications")
    .insert({
      project_id: projectId,
      provider_id: userId,
      cover_message: input.cover_message,
      proposed_price: input.proposed_price ?? null,
      estimated_delivery_days: input.estimated_delivery_days ?? null,
      status: "pending",
    })
    .select("id, status")
    .single();

  if (error) {
    return { error: error.message };
  }

  return { data };
}

export async function getProjectApplicationsForClient(
  supabase: SupabaseClient<Database>,
  userId: string,
  projectId: string,
): Promise<ProjectResult<ClientProjectApplicationSummary[]>> {
  const clientState = await ensureClientUser(supabase, userId);

  if (clientState.error) {
    return { error: clientState.error };
  }

  const ownedProject = await getOwnedProjectRecord(supabase, userId, projectId);

  if (ownedProject.error) {
    return { error: ownedProject.error };
  }

  const { data, error } = await supabase
    .from("applications")
    .select(
      "id, project_id, provider_id, status, cover_message, proposed_price, estimated_delivery_days, created_at, updated_at, provider:profiles!applications_provider_id_fkey(id, full_name, email, phone, country, city)",
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    return { error: error.message };
  }

  return {
    data: (data ?? []).map((item) => ({
      ...item,
      provider: Array.isArray(item.provider) ? item.provider[0] ?? null : item.provider,
    })),
  };
}

export async function getProjectApplicationForClient(
  supabase: SupabaseClient<Database>,
  userId: string,
  applicationId: string,
): Promise<ProjectResult<ClientProjectApplicationDetail>> {
  const clientState = await ensureClientUser(supabase, userId);

  if (clientState.error) {
    return { error: clientState.error };
  }

  const { data, error } = await supabase
    .from("applications")
    .select(
      "id, project_id, provider_id, status, cover_message, proposed_price, estimated_delivery_days, created_at, updated_at, provider:profiles!applications_provider_id_fkey(id, full_name, email, phone, country, city), project:projects!applications_project_id_fkey(id, title, slug, status, client_id)",
    )
    .eq("id", applicationId)
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }

  if (!data) {
    return { error: "Application not found." };
  }

  const project = Array.isArray(data.project) ? data.project[0] ?? null : data.project;

  if (!project || project.client_id !== userId) {
    return { error: "Application not found." };
  }

  return {
    data: {
      ...data,
      provider: Array.isArray(data.provider) ? data.provider[0] ?? null : data.provider,
      project,
    },
  };
}

export async function updateProjectApplicationStatusForClient(
  supabase: SupabaseClient<Database>,
  userId: string,
  applicationId: string,
  input: UpdateApplicationStatusInput,
): Promise<ProjectResult<{ id: string; status: Database["public"]["Enums"]["application_status"] }>> {
  const clientState = await ensureClientUser(supabase, userId);

  if (clientState.error) {
    return { error: clientState.error };
  }

  const applicationResult = await getProjectApplicationForClient(
    supabase,
    userId,
    applicationId,
  );

  if (applicationResult.error) {
    return { error: applicationResult.error };
  }

  const application = applicationResult.data;

  if (!application) {
    return { error: "Application not found." };
  }

  const currentStatus = application.status;
  const nextStatus = input.status;

  if (
    currentStatus === "accepted" ||
    currentStatus === "rejected" ||
    currentStatus === "withdrawn"
  ) {
    return { error: "This application can no longer be updated." };
  }

  if (currentStatus === nextStatus) {
    return {
      data: {
        id: application.id,
        status: application.status,
      },
    };
  }

  if (nextStatus === "accepted") {
    const { data: acceptedApplication, error: acceptedApplicationError } =
      await supabase
        .from("applications")
        .select("id")
        .eq("project_id", application.project_id)
        .eq("status", "accepted")
        .neq("id", applicationId)
        .maybeSingle();

    if (acceptedApplicationError) {
      return { error: acceptedApplicationError.message };
    }

    if (acceptedApplication) {
      return { error: "A provider has already been accepted for this project." };
    }
  }

  const { data, error } = await supabase
    .from("applications")
    .update({ status: nextStatus })
    .eq("id", applicationId)
    .select("id, status")
    .single();

  if (error) {
    return { error: error.message };
  }

  if (nextStatus === "accepted") {
    const { error: rejectOthersError } = await supabase
      .from("applications")
      .update({ status: "rejected" })
      .eq("project_id", application.project_id)
      .neq("id", applicationId)
      .in("status", ["pending", "viewed", "shortlisted"]);

    if (rejectOthersError) {
      return { error: rejectOthersError.message };
    }

    const conversationResult = await ensureConversationForAcceptedApplication(
      supabase,
      applicationId,
    );

    if (conversationResult.error) {
      return { error: conversationResult.error };
    }
  }

  return { data };
}
