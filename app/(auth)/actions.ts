"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { AuthActionState } from "@/app/(auth)/action-state";
import { clientProfileInputSchema } from "@/lib/auth/client-profile";
import { providerProfileInputSchema } from "@/lib/auth/provider-profile";
import { getDashboardPathForRole } from "@/lib/auth/profile-completion";
import { ensureUserProfile } from "@/lib/auth/provision";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long.")
  .max(72, "Password must be 72 characters or fewer.");

const personNamePattern = /^[\p{L}\p{M}][\p{L}\p{M}'’. -]*$/u;
const placeNamePattern = /^[\p{L}\p{M}][\p{L}\p{M}'’. -]*$/u;
const phonePattern = /^\+?[0-9().\-\s]{7,20}$/;

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function requiredText(
  label: string,
  {
    min,
    max,
    pattern,
    patternMessage,
  }: {
    min: number;
    max: number;
    pattern?: RegExp;
    patternMessage?: string;
  },
) {
  return z
    .string()
    .transform(normalizeWhitespace)
    .pipe(
      z
        .string()
        .min(min, `${label} must be at least ${min} characters long.`)
        .max(max, `${label} must be ${max} characters or fewer.`),
    )
    .superRefine((value, ctx) => {
      if (pattern && !pattern.test(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: patternMessage ?? `${label} contains invalid characters.`,
        });
      }
    });
}

const requiredPhone = z
  .string()
  .transform(normalizeWhitespace)
  .pipe(
    z
      .string()
      .min(7, "Phone is required.")
      .max(20, "Phone must be 20 characters or fewer."),
  )
  .superRefine((value, ctx) => {
    if (!phonePattern.test(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Phone can only contain numbers, spaces, parentheses, dots, hyphens, and an optional leading +.",
      });
    }

    const digitCount = value.replace(/\D/g, "").length;

    if (digitCount < 7 || digitCount > 15) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Phone must contain between 7 and 15 digits.",
      });
    }
  });

const accountSchema = z.object({
  full_name: requiredText("Full name", {
    min: 2,
    max: 80,
    pattern: personNamePattern,
    patternMessage:
      "Full name can only contain letters, spaces, apostrophes, periods, and hyphens.",
  }),
  email: z.string().trim().email("Enter a valid email address."),
  phone: requiredPhone,
  country: requiredText("Country", {
    min: 2,
    max: 56,
    pattern: placeNamePattern,
    patternMessage:
      "Country can only contain letters, spaces, apostrophes, periods, and hyphens.",
  }),
  city: requiredText("City", {
    min: 2,
    max: 56,
    pattern: placeNamePattern,
    patternMessage:
      "City can only contain letters, spaces, apostrophes, periods, and hyphens.",
  }),
  password: passwordSchema,
});

const clientRegisterSchema = accountSchema
  .extend({
    role: z.literal("client"),
  })
  .and(clientProfileInputSchema);

const providerRegisterSchema = accountSchema
  .extend({ role: z.literal("provider") })
  .and(providerProfileInputSchema);

const registerSchema = z.union([clientRegisterSchema, providerRegisterSchema]);

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
    phone: getStringValue(formData, "phone"),
    country: getStringValue(formData, "country"),
    city: getStringValue(formData, "city"),
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
    tax_id: getStringValue(formData, "tax_id"),
    years_of_experience: getStringValue(formData, "years_of_experience"),
    portfolio_url: getStringValue(formData, "portfolio_url"),
    social_link: getStringValue(formData, "social_link"),
    service_category_other_text: getStringValue(
      formData,
      "service_category_other_text",
    ),
    about: getStringValue(formData, "about"),
    interested_solution_types: formData
      .getAll("interested_solution_types")
      .filter((value): value is string => typeof value === "string")
      .join("||"),
    service_categories: formData
      .getAll("service_categories")
      .filter((value): value is string => typeof value === "string")
      .join("||"),
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
  role: "client" | "provider" | "admin",
  userId: string,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<never> {
  void userId;
  void supabase;
  redirect(getDashboardPathForRole(role));
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
    service_categories: formData.getAll("service_categories"),
  });

  if (!parsed.success) {
    return validationError(fields, parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  let redirectUserId: string | null = null;

  try {
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: {
          full_name: parsed.data.full_name,
          email: parsed.data.email,
          phone: parsed.data.phone,
          country: parsed.data.country,
          city: parsed.data.city,
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
                tax_id: parsed.data.tax_id,
                years_of_experience: parsed.data.years_of_experience,
                portfolio_url: parsed.data.portfolio_url,
                social_link: parsed.data.social_link,
                service_categories: parsed.data.service_categories,
                service_category_other_text:
                  parsed.data.service_category_other_text,
                about: parsed.data.about,
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
      phone: parsed.data.phone,
      country: parsed.data.country,
      city: parsed.data.city,
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
        tax_id: parsed.data.tax_id,
        years_of_experience: parsed.data.years_of_experience,
        portfolio_url: parsed.data.portfolio_url,
        social_link: parsed.data.social_link,
        service_categories: parsed.data.service_categories,
        service_category_other_text: parsed.data.service_category_other_text,
        about: parsed.data.about,
      });

      if (error) {
        throw new Error(error.message);
      }
    }

    redirectUserId = userId;
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

  if (redirectUserId) {
    await redirectToRoleHome(parsed.data.role, redirectUserId, supabase);
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
