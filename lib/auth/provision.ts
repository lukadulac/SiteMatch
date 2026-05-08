import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isAppRole, type UserRole } from "@/lib/auth/roles";
import type { Database } from "@/types/supabase";

type ProvisionResult = {
  error?: string;
  role?: UserRole;
};

function getStringValue(value: unknown) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function getNumberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);

    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return null;
}

export async function ensureUserProfile(
  supabase: SupabaseClient<Database>,
  user: User,
): Promise<ProvisionResult> {
  const { data: existingProfile, error: existingProfileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (existingProfileError) {
    return { error: existingProfileError.message };
  }

  if (existingProfile && isAppRole(existingProfile.role)) {
    return { role: existingProfile.role };
  }

  const metadata =
    user.user_metadata && typeof user.user_metadata === "object"
      ? user.user_metadata
      : {};

  const role = getStringValue(metadata.role);

  if (!role || !isAppRole(role)) {
    return { error: "Your account is missing a valid role." };
  }

  const fullName =
    getStringValue(metadata.full_name) ??
    getStringValue(user.user_metadata?.name) ??
    getStringValue(user.email?.split("@")[0]) ??
    "New user";

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      role,
      full_name: fullName,
      email: user.email ?? "",
    },
    { onConflict: "id" },
  );

  if (profileError) {
    return { error: profileError.message };
  }

  if (role === "client") {
    const { error } = await supabase.from("client_profiles").upsert(
      {
        user_id: user.id,
        business_name: getStringValue(metadata.business_name) ?? fullName,
        business_type: getStringValue(metadata.business_type),
        business_type_text: getStringValue(metadata.business_type_text),
        business_tax_id: getStringValue(metadata.business_tax_id),
        project_idea: getStringValue(metadata.project_idea),
        interested_solution_types: Array.isArray(metadata.interested_solution_types)
          ? metadata.interested_solution_types.filter(
              (value): value is string => typeof value === "string" && value.trim() !== "",
            )
          : [],
        interested_solution_other_text: getStringValue(
          metadata.interested_solution_other_text,
        ),
      },
      { onConflict: "user_id" },
    );

    if (error) {
      return { error: error.message };
    }
  }

  if (role === "provider") {
    const providerType = getStringValue(metadata.provider_type);
    const safeProviderType =
      providerType === "agency" || providerType === "studio"
        ? providerType
        : "freelancer";

    const { error } = await supabase.from("provider_profiles").upsert(
      {
        user_id: user.id,
        provider_type: safeProviderType,
        headline: getStringValue(metadata.headline),
        bio: getStringValue(metadata.bio),
        years_of_experience: getNumberValue(metadata.years_of_experience),
        portfolio_url: getStringValue(metadata.portfolio_url),
      },
      { onConflict: "user_id" },
    );

    if (error) {
      return { error: error.message };
    }
  }

  return { role };
}
