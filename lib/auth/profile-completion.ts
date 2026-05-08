import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/auth/roles";
import type { Database } from "@/types/supabase";

type ClientCompletionProfile =
  | Pick<
      Database["public"]["Tables"]["client_profiles"]["Row"],
      | "business_name"
      | "business_type"
      | "business_type_text"
      | "project_idea"
      | "interested_solution_types"
      | "interested_solution_other_text"
    >
  | null;
type ProviderCompletionProfile =
  | Pick<
      Database["public"]["Tables"]["provider_profiles"]["Row"],
      | "provider_type"
      | "headline"
      | "bio"
      | "years_of_experience"
      | "portfolio_url"
      | "availability"
    >
  | null;

function hasText(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

export function isClientProfileComplete(profile: ClientCompletionProfile) {
  if (!profile) {
    return false;
  }

  return (
    hasText(profile.business_name) &&
    hasText(profile.business_type) &&
    (profile.business_type !== "other" || hasText(profile.business_type_text)) &&
    hasText(profile.project_idea) &&
    profile.interested_solution_types.length > 0 &&
    (!profile.interested_solution_types.includes("other") ||
      hasText(profile.interested_solution_other_text))
  );
}

export function isProviderProfileComplete(profile: ProviderCompletionProfile) {
  if (!profile) {
    return false;
  }

  return (
    !!profile.provider_type &&
    hasText(profile.headline) &&
    hasText(profile.bio) &&
    profile.years_of_experience != null &&
    hasText(profile.portfolio_url) &&
    !!profile.availability
  );
}

export function getDashboardPathForRole(role: UserRole) {
  if (role === "client") {
    return "/dashboard/client";
  }

  if (role === "provider") {
    return "/dashboard/provider";
  }

  return "/dashboard/admin";
}

export function getOnboardingPathForRole(role: UserRole) {
  if (role === "client") {
    return "/onboarding/client";
  }

  if (role === "provider") {
    return "/onboarding/provider";
  }

  return "/dashboard/admin";
}

export async function getProfileCompletionStatus(
  supabase: SupabaseClient<Database>,
  userId: string,
  role: UserRole,
) {
  if (role === "admin") {
    return { isComplete: true };
  }

  if (role === "client") {
    const { data, error } = await supabase
      .from("client_profiles")
      .select(
        "id, business_name, business_type, business_type_text, business_tax_id, project_idea, interested_solution_types, interested_solution_other_text, website_url, company_size, created_at, user_id",
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      return { isComplete: false, error: error.message };
    }

    return { isComplete: isClientProfileComplete(data) };
  }

  const { data, error } = await supabase
    .from("provider_profiles")
    .select(
      "id, user_id, provider_type, headline, bio, years_of_experience, portfolio_url, hourly_rate_min, hourly_rate_max, fixed_price_min, fixed_price_max, availability, is_verified, average_rating, total_reviews, created_at, updated_at",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return { isComplete: false, error: error.message };
  }

  return { isComplete: isProviderProfileComplete(data) };
}

export async function resolvePostAuthPath(
  supabase: SupabaseClient<Database>,
  userId: string,
  role: UserRole,
) {
  const completion = await getProfileCompletionStatus(supabase, userId, role);

  if (completion.error) {
    return { path: getDashboardPathForRole(role), ...completion };
  }

  return {
    path: completion.isComplete
      ? getDashboardPathForRole(role)
      : getOnboardingPathForRole(role),
    ...completion,
  };
}
