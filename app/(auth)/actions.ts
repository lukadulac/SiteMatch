"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { AuthActionState } from "@/app/(auth)/action-state";
import { clientProfileInputSchema } from "@/lib/auth/client-profile";
import { resolvePostAuthPath } from "@/lib/auth/profile-completion";
import type { UserRole } from "@/lib/auth/roles";
import { ensureUserProfile } from "@/lib/auth/provision";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long.")
  .max(72, "Password must be 72 characters or fewer.");

const accountSchema = z.object({
  full_name: z.string().trim().min(2, "Full name is required."),
  email: z.string().trim().email("Enter a valid email address."),
  password: passwordSchema,
});

const clientRegisterSchema = clientProfileInputSchema.extend({
  full_name: z.string().trim().min(2, "Full name is required."),
  email: z.string().trim().email("Enter a valid email address."),
  password: passwordSchema,
  role: z.literal("client"),
});

const registerSchema = z.discriminatedUnion("role", [
  clientRegisterSchema,
  accountSchema.extend({
    role: z.literal("provider"),
    provider_type: z.enum(["freelancer", "agency", "studio"]),
    headline: z.string().trim().min(3, "Headline is required."),
    bio: z
      .string()
      .trim()
      .min(20, "Bio must be at least 20 characters long."),
    years_of_experience: z.coerce
      .number()
      .int("Years of experience must be a whole number.")
      .min(0, "Years of experience cannot be negative."),
    portfolio_url: z.url("Enter a valid portfolio URL."),
  }),
]);

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

function getStringValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function collectRegisterFields(formData: FormData) {
  return {
    full_name: getStringValue(formData, "full_name"),
    email: getStringValue(formData, "email"),
    role: getStringValue(formData, "role"),
    business_name: getStringValue(formData, "business_name"),
    business_tax_id: getStringValue(formData, "business_tax_id"),
    business_type: getStringValue(formData, "business_type"),
    business_type_text: getStringValue(formData, "business_type_text"),
    project_idea: getStringValue(formData, "project_idea"),
    interested_solution_other_text: getStringValue(
      formData,
      "interested_solution_other_text",
    ),
    provider_type: getStringValue(formData, "provider_type"),
    headline: getStringValue(formData, "headline"),
    bio: getStringValue(formData, "bio"),
    years_of_experience: getStringValue(formData, "years_of_experience"),
    portfolio_url: getStringValue(formData, "portfolio_url"),
  };
}

function validationError(
  fields: Record<string, string>,
  fieldErrors: Record<string, string[] | undefined>,
): AuthActionState {
  return {
    formError: "Please fix the highlighted fields.",
    formSuccess: undefined,
    fieldErrors,
    fields,
  };
}

async function redirectToRoleHome(
  role: UserRole,
  userId: string,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<never> {
  const resolved = await resolvePostAuthPath(supabase, userId, role);
  redirect(resolved.path);
}

export async function registerAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const fields = collectRegisterFields(formData);
  const parsed = registerSchema.safeParse({
    ...fields,
    password: getStringValue(formData, "password"),
    years_of_experience: fields.years_of_experience,
    interested_solution_types: formData.getAll("interested_solution_types"),
  });

  if (!parsed.success) {
    return validationError(fields, parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();

  try {
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: {
          full_name: parsed.data.full_name,
          email: parsed.data.email,
          role: parsed.data.role,
          ...(parsed.data.role === "client"
            ? {
                business_name: parsed.data.business_name,
                business_tax_id: parsed.data.business_tax_id,
                business_type: parsed.data.business_type,
                business_type_text: parsed.data.business_type_text,
                project_idea: parsed.data.project_idea,
                interested_solution_types: parsed.data.interested_solution_types,
                interested_solution_other_text:
                  parsed.data.interested_solution_other_text,
              }
            : {
                provider_type: parsed.data.provider_type,
                headline: parsed.data.headline,
                bio: parsed.data.bio,
                years_of_experience: parsed.data.years_of_experience,
                portfolio_url: parsed.data.portfolio_url,
              }),
        },
      },
    });

    if (signUpError || !authData.user) {
      return {
        formError:
          signUpError?.message ??
          "We could not create your account. Please try again.",
        formSuccess: undefined,
        fieldErrors: {},
        fields,
      };
    }

    if (!authData.session) {
      return {
        formError: undefined,
        formSuccess:
          "Your account was created. Please confirm your email, then log in.",
        fieldErrors: {},
        fields: {
          email: parsed.data.email,
        },
      };
    }

    const userId = authData.user.id;

    const { error: profileError } = await supabase.from("profiles").insert({
      id: userId,
      role: parsed.data.role,
      full_name: parsed.data.full_name,
      email: parsed.data.email,
    });

    if (profileError) {
      throw new Error(profileError.message);
    }

    if (parsed.data.role === "client") {
      const { error } = await supabase.from("client_profiles").insert({
        user_id: userId,
        business_name: parsed.data.business_name,
        business_tax_id: parsed.data.business_tax_id,
        business_type: parsed.data.business_type,
        business_type_text: parsed.data.business_type_text,
        project_idea: parsed.data.project_idea,
        interested_solution_types: parsed.data.interested_solution_types,
        interested_solution_other_text: parsed.data.interested_solution_other_text,
      });

      if (error) {
        throw new Error(error.message);
      }
    }

    if (parsed.data.role === "provider") {
      const { error } = await supabase.from("provider_profiles").insert({
        user_id: userId,
        provider_type: parsed.data.provider_type,
        headline: parsed.data.headline,
        bio: parsed.data.bio,
        years_of_experience: parsed.data.years_of_experience,
        portfolio_url: parsed.data.portfolio_url,
      });

      if (error) {
        throw new Error(error.message);
      }
    }

    await redirectToRoleHome(parsed.data.role, userId, supabase);
  } catch (error) {
    await supabase.auth.signOut();

    return {
      formError:
        error instanceof Error
          ? `${error.message} If the auth user was created before this failed, you may need to remove that user from Supabase Auth before retrying.`
          : "We could not finish creating your account. Please try again.",
      formSuccess: undefined,
      fieldErrors: {},
      fields,
    };
  }

  return {
    formError: "We could not determine where to send you after signup.",
    formSuccess: undefined,
    fieldErrors: {},
    fields,
  };
}

export async function loginAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const fields = {
    email: getStringValue(formData, "email"),
  };

  const parsed = loginSchema.safeParse({
    email: fields.email,
    password: getStringValue(formData, "password"),
  });

  if (!parsed.success) {
    return validationError(fields, parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (signInError) {
    return {
      formError: "Invalid email or password.",
      formSuccess: undefined,
      fieldErrors: {},
      fields,
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      formError: "Your session could not be established. Please try again.",
      formSuccess: undefined,
      fieldErrors: {},
      fields,
    };
  }

  const provisioned = await ensureUserProfile(supabase, user);

  if (!provisioned.role) {
    await supabase.auth.signOut();

    return {
      formError:
        provisioned.error ??
        "Your account exists, but the marketplace profile is missing or invalid.",
      formSuccess: undefined,
      fieldErrors: {},
      fields,
    };
  }

  await redirectToRoleHome(provisioned.role, user.id, supabase);

  return {
    formError: "We could not determine where to send you after login.",
    formSuccess: undefined,
    fieldErrors: {},
    fields,
  };
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();

  await supabase.auth.signOut();
  redirect("/login");
}
