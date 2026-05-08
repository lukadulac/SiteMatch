"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { DashboardActionState } from "@/app/dashboard/action-state";
import { clientProfileInputSchema } from "@/lib/auth/client-profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const providerOnboardingSchema = z.object({
  provider_type: z.enum(["freelancer", "agency", "studio"]),
  headline: z.string().trim().min(3, "Headline is required."),
  bio: z.string().trim().min(20, "Bio must be at least 20 characters long."),
  years_of_experience: z.coerce
    .number()
    .int("Years of experience must be a whole number.")
    .min(0, "Years of experience cannot be negative."),
  portfolio_url: z.url("Enter a valid portfolio URL."),
  availability: z.enum(["available", "busy", "unavailable"]),
});

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function validationError(
  fieldErrors: Record<string, string[] | undefined>,
): DashboardActionState {
  return {
    formError: "Please fix the highlighted fields.",
    formSuccess: undefined,
    fieldErrors,
  };
}

async function getAuthenticatedRole() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, role: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return { supabase, user, role: profile?.role ?? null };
}

export async function completeClientOnboardingAction(
  _previousState: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  const parsed = clientProfileInputSchema.safeParse({
    business_name: getFormValue(formData, "business_name"),
    business_tax_id: getFormValue(formData, "business_tax_id"),
    business_type: getFormValue(formData, "business_type"),
    business_type_text: getFormValue(formData, "business_type_text"),
    project_idea: getFormValue(formData, "project_idea"),
    interested_solution_types: formData.getAll("interested_solution_types"),
    interested_solution_other_text: getFormValue(
      formData,
      "interested_solution_other_text",
    ),
  });

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors);
  }

  const { supabase, user, role } = await getAuthenticatedRole();

  if (!user || role !== "client") {
    return {
      formError: "You must be signed in as a client to continue.",
      formSuccess: undefined,
      fieldErrors: {},
    };
  }

  const { error } = await supabase.from("client_profiles").upsert(
    {
      user_id: user.id,
      business_name: parsed.data.business_name,
      business_tax_id: parsed.data.business_tax_id,
      business_type: parsed.data.business_type,
      business_type_text: parsed.data.business_type_text,
      project_idea: parsed.data.project_idea,
      interested_solution_types: parsed.data.interested_solution_types,
      interested_solution_other_text: parsed.data.interested_solution_other_text,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return {
      formError: error.message,
      formSuccess: undefined,
      fieldErrors: {},
    };
  }

  revalidatePath("/onboarding/client");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/client");
  redirect("/dashboard/client");
}

export async function completeProviderOnboardingAction(
  _previousState: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  const parsed = providerOnboardingSchema.safeParse({
    provider_type: getFormValue(formData, "provider_type"),
    headline: getFormValue(formData, "headline"),
    bio: getFormValue(formData, "bio"),
    years_of_experience: getFormValue(formData, "years_of_experience"),
    portfolio_url: getFormValue(formData, "portfolio_url"),
    availability: getFormValue(formData, "availability"),
  });

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors);
  }

  const { supabase, user, role } = await getAuthenticatedRole();

  if (!user || role !== "provider") {
    return {
      formError: "You must be signed in as a provider to continue.",
      formSuccess: undefined,
      fieldErrors: {},
    };
  }

  const { error } = await supabase.from("provider_profiles").upsert(
    {
      user_id: user.id,
      provider_type: parsed.data.provider_type,
      headline: parsed.data.headline,
      bio: parsed.data.bio,
      years_of_experience: parsed.data.years_of_experience,
      portfolio_url: parsed.data.portfolio_url,
      availability: parsed.data.availability,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return {
      formError: error.message,
      formSuccess: undefined,
      fieldErrors: {},
    };
  }

  revalidatePath("/onboarding/provider");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/provider");
  redirect("/dashboard/provider");
}
