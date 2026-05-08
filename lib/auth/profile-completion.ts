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

export function getDashboardPathForRole(role: UserRole) {
  if (role === "client") {
    return "/dashboard/client";
  }

  if (role === "provider") {
    return "/dashboard/provider";
  }

  return "/dashboard/admin";
}
