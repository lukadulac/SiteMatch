"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { ListingsActionState } from "@/app/oglasi/action-state";
import {
  createProjectSchema,
  updateApplicationStatusSchema,
} from "@/lib/projects/schemas";
import {
  createProject,
  updateClientProject,
  updateProjectApplicationStatusForClient,
} from "@/lib/projects/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const MULTI_VALUE_SEPARATOR = "||";

function getStringValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getNullableStringValue(formData: FormData, key: string) {
  const value = getStringValue(formData, key).trim();
  return value === "" ? null : value;
}

function getNumberValue(formData: FormData, key: string) {
  const value = getStringValue(formData, key).trim();

  if (value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function getBooleanValue(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function getStringArray(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((value) => (typeof value === "string" ? value : ""))
    .filter((value) => value.trim().length > 0);
}

function buildFields(formData: FormData): Record<string, string> {
  const entries = [
    "title",
    "description",
    "service_type_id",
    "business_domain_id",
    "business_domain_other_text",
    "business_context_text",
    "what_do_you_need_text",
    "target_audience_text",
    "success_criteria_text",
    "goal_other_text",
    "budget_type",
    "budget_min",
    "budget_max",
    "deadline_type",
    "deadline_date",
    "desired_start_date",
    "readiness_level",
    "scope_level",
    "estimated_pages",
    "existing_website_url",
    "preferred_language",
    "preferred_provider_type",
    "discovery_notes",
  ];

  return {
    ...Object.fromEntries(entries.map((key) => [key, getStringValue(formData, key)])),
    goal_ids: getStringArray(formData, "goal_ids").join(MULTI_VALUE_SEPARATOR),
    feature_ids: getStringArray(formData, "feature_ids").join(MULTI_VALUE_SEPARATOR),
    has_existing_website: getBooleanValue(formData, "has_existing_website")
      ? "true"
      : "",
    needs_design: getBooleanValue(formData, "needs_design") ? "true" : "",
    needs_seo: getBooleanValue(formData, "needs_seo") ? "true" : "",
    needs_content_writing: getBooleanValue(formData, "needs_content_writing")
      ? "true"
      : "",
    is_remote_friendly: getBooleanValue(formData, "is_remote_friendly")
      ? "true"
      : "",
  };
}

function validationError(
  formData: FormData,
  fieldErrors: Record<string, string[] | undefined>,
  formError = "Please fix the highlighted fields.",
): ListingsActionState {
  return {
    formError,
    fieldErrors,
    fields: buildFields(formData),
  };
}

export async function createClientProjectAction(
  _prevState: ListingsActionState,
  formData: FormData,
): Promise<ListingsActionState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      formError: "You must be signed in to create a listing.",
      fieldErrors: {},
      fields: buildFields(formData),
    };
  }

  const payload = {
    title: getStringValue(formData, "title"),
    description: getStringValue(formData, "description"),
    service_type_id: getStringValue(formData, "service_type_id"),
    business_domain_id: getNullableStringValue(formData, "business_domain_id"),
    business_domain_other_text: getNullableStringValue(
      formData,
      "business_domain_other_text",
    ),
    business_context_text: getNullableStringValue(formData, "business_context_text"),
    what_do_you_need_text: getStringValue(formData, "what_do_you_need_text"),
    target_audience_text: getNullableStringValue(formData, "target_audience_text"),
    success_criteria_text: getNullableStringValue(formData, "success_criteria_text"),
    goal_other_text: getNullableStringValue(formData, "goal_other_text"),
    goal_ids: getStringArray(formData, "goal_ids"),
    feature_ids: getStringArray(formData, "feature_ids"),
    budget_type: getStringValue(formData, "budget_type") || "range",
    budget_min: getNumberValue(formData, "budget_min"),
    budget_max: getNumberValue(formData, "budget_max"),
    deadline_type: getStringValue(formData, "deadline_type") || "flexible",
    deadline_date: getNullableStringValue(formData, "deadline_date"),
    desired_start_date: getNullableStringValue(formData, "desired_start_date"),
    readiness_level: getNullableStringValue(formData, "readiness_level"),
    scope_level: getNullableStringValue(formData, "scope_level"),
    estimated_pages: getNumberValue(formData, "estimated_pages"),
    has_existing_website: getBooleanValue(formData, "has_existing_website"),
    existing_website_url: getNullableStringValue(formData, "existing_website_url"),
    needs_design: getBooleanValue(formData, "needs_design"),
    needs_seo: getBooleanValue(formData, "needs_seo"),
    needs_content_writing: getBooleanValue(formData, "needs_content_writing"),
    is_remote_friendly: getBooleanValue(formData, "is_remote_friendly"),
    preferred_language: getNullableStringValue(formData, "preferred_language"),
    preferred_provider_type:
      getStringValue(formData, "preferred_provider_type") || "any",
    discovery_notes: getNullableStringValue(formData, "discovery_notes"),
    status: getStringValue(formData, "status") || "draft",
  };

  const parsed = createProjectSchema.safeParse(payload);

  if (!parsed.success) {
    return validationError(formData, parsed.error.flatten().fieldErrors);
  }

  const result = await createProject(supabase, user.id, parsed.data);

  if (result.error) {
    return validationError(formData, {}, result.error);
  }

  revalidatePath("/oglasi");
  revalidatePath("/dashboard/client");
  redirect("/oglasi");
}

export async function updateClientProjectAction(
  projectId: string,
  _prevState: ListingsActionState,
  formData: FormData,
): Promise<ListingsActionState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      formError: "You must be signed in to update a listing.",
      fieldErrors: {},
      fields: buildFields(formData),
    };
  }

  const payload = {
    title: getStringValue(formData, "title"),
    description: getStringValue(formData, "description"),
    service_type_id: getStringValue(formData, "service_type_id"),
    business_domain_id: getNullableStringValue(formData, "business_domain_id"),
    business_domain_other_text: getNullableStringValue(
      formData,
      "business_domain_other_text",
    ),
    business_context_text: getNullableStringValue(formData, "business_context_text"),
    what_do_you_need_text: getStringValue(formData, "what_do_you_need_text"),
    target_audience_text: getNullableStringValue(formData, "target_audience_text"),
    success_criteria_text: getNullableStringValue(formData, "success_criteria_text"),
    goal_other_text: getNullableStringValue(formData, "goal_other_text"),
    goal_ids: getStringArray(formData, "goal_ids"),
    feature_ids: getStringArray(formData, "feature_ids"),
    budget_type: getStringValue(formData, "budget_type") || "range",
    budget_min: getNumberValue(formData, "budget_min"),
    budget_max: getNumberValue(formData, "budget_max"),
    deadline_type: getStringValue(formData, "deadline_type") || "flexible",
    deadline_date: getNullableStringValue(formData, "deadline_date"),
    desired_start_date: getNullableStringValue(formData, "desired_start_date"),
    readiness_level: getNullableStringValue(formData, "readiness_level"),
    scope_level: getNullableStringValue(formData, "scope_level"),
    estimated_pages: getNumberValue(formData, "estimated_pages"),
    has_existing_website: getBooleanValue(formData, "has_existing_website"),
    existing_website_url: getNullableStringValue(formData, "existing_website_url"),
    needs_design: getBooleanValue(formData, "needs_design"),
    needs_seo: getBooleanValue(formData, "needs_seo"),
    needs_content_writing: getBooleanValue(formData, "needs_content_writing"),
    is_remote_friendly: getBooleanValue(formData, "is_remote_friendly"),
    preferred_language: getNullableStringValue(formData, "preferred_language"),
    preferred_provider_type:
      getStringValue(formData, "preferred_provider_type") || "any",
    discovery_notes: getNullableStringValue(formData, "discovery_notes"),
    status: getStringValue(formData, "status") || "draft",
  };

  const parsed = createProjectSchema.safeParse(payload);

  if (!parsed.success) {
    return validationError(formData, parsed.error.flatten().fieldErrors);
  }

  const result = await updateClientProject(supabase, user.id, projectId, parsed.data);

  if (result.error) {
    return validationError(formData, {}, result.error);
  }

  revalidatePath("/oglasi");
  revalidatePath("/dashboard/client");
  redirect("/oglasi");
}

export async function updateClientApplicationStatusAction(
  projectId: string,
  applicationId: string,
  status: "accepted" | "rejected",
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const parsed = updateApplicationStatusSchema.safeParse({ status });

  if (!parsed.success) {
    throw new Error("Invalid application status.");
  }

  const result = await updateProjectApplicationStatusForClient(
    supabase,
    user.id,
    applicationId,
    parsed.data,
  );

  if (result.error) {
    throw new Error(result.error);
  }

  revalidatePath("/oglasi");
  revalidatePath(`/oglasi/${projectId}`);
  revalidatePath("/dashboard/client");
  revalidatePath("/dashboard/provider");
}
