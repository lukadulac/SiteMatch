import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

type ProjectFormMetaResult =
  | {
      data: {
        serviceTypes: Database["public"]["Tables"]["service_types"]["Row"][];
        businessDomains: Database["public"]["Tables"]["business_domains"]["Row"][];
        projectGoals: Database["public"]["Tables"]["project_goals"]["Row"][];
        featureTags: Database["public"]["Tables"]["feature_tags"]["Row"][];
      };
      error?: never;
    }
  | {
      data?: never;
      error: string;
    };

export async function getProjectFormMeta(
  supabase: SupabaseClient<Database>,
): Promise<ProjectFormMetaResult> {
  const [
    { data: serviceTypes, error: serviceTypesError },
    { data: businessDomains, error: businessDomainsError },
    { data: projectGoals, error: projectGoalsError },
    { data: featureTags, error: featureTagsError },
  ] = await Promise.all([
    supabase
      .from("service_types")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("business_domains")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("project_goals")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("feature_tags")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  const firstError =
    serviceTypesError ??
    businessDomainsError ??
    projectGoalsError ??
    featureTagsError;

  if (firstError) {
    return { error: firstError.message };
  }

  return {
    data: {
      serviceTypes: serviceTypes ?? [],
      businessDomains: businessDomains ?? [],
      projectGoals: projectGoals ?? [],
      featureTags: featureTags ?? [],
    },
  };
}
