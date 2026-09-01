"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { AuthActionState } from "@/app/(auth)/action-state";
import { clientProfileInputSchema } from "@/lib/auth/client-profile";
import { providerProfileInputSchema } from "@/lib/auth/provider-profile";
import { ensureUserProfile } from "@/lib/auth/provision";
import {
	AUTH_RATE_LIMITS,
	checkAuthRateLimit,
	createRateLimitKey,
	getRequestIp,
	normalizeRateLimitEmail,
	recordAuthRateLimitAttempt,
	resetAuthRateLimit,
} from "@/lib/auth/rate-limit";
import { getDashboardPath } from "@/lib/auth/roles";
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
  redirect(getDashboardPath(role));
}

export async function registerAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const fields = collectRegisterFields(formData);
  const registerInput = {
    ...fields,
    password: getStringValue(formData, "password"),
    years_of_experience: fields.years_of_experience,
    interested_solution_types: formData.getAll("interested_solution_types"),
    service_categories: formData.getAll("service_categories"),
  };

  const parsed =
    fields.role === "client"
      ? clientRegisterSchema.safeParse(registerInput)
      : fields.role === "provider"
        ? providerRegisterSchema.safeParse(registerInput)
        : null;

  if (!parsed) {
    return validationError(fields, {
      role: ["Choose whether you want to hire talent or find work."],
    });
  }

  if (!parsed.success) {
    return validationError(fields, parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const requestIp = getRequestIp(await headers());
  const registerIpKey = createRateLimitKey([
    AUTH_RATE_LIMITS.registerIp.scope,
    requestIp,
  ]);
  const registerLimit = await recordAuthRateLimitAttempt(
    supabase,
    AUTH_RATE_LIMITS.registerIp,
    registerIpKey,
  );

  if (!registerLimit.allowed) {
    return {
      formError: "We could not create your account. Please try again.",
      formSuccess: undefined,
      fieldErrors: {},
      fields,
    };
  }

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
        formError: "We could not create your account. Please try again.",
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
    const provisioned = await ensureUserProfile(supabase, authData.user);

    if (provisioned.error || !provisioned.role) {
      throw new Error(
        provisioned.error ?? "We could not finish creating your profile.",
      );

    }

    redirectUserId = userId;
  } catch (error) {
    console.error("Registration failed", error);
    await supabase.auth.signOut();

    return {
      formError: "We could not finish creating your account. Please try again.",
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
  const requestIp = getRequestIp(await headers());
  const normalizedEmail = normalizeRateLimitEmail(parsed.data.email);
  const loginEmailIpKey = createRateLimitKey([
    AUTH_RATE_LIMITS.loginEmailIp.scope,
    normalizedEmail,
    requestIp,
  ]);
  const loginIpKey = createRateLimitKey([
    AUTH_RATE_LIMITS.loginIp.scope,
    requestIp,
  ]);
  const loginEmailIpLimit = await checkAuthRateLimit(
    supabase,
    AUTH_RATE_LIMITS.loginEmailIp.scope,
    loginEmailIpKey,
  );
  const loginIpLimit = await checkAuthRateLimit(
    supabase,
    AUTH_RATE_LIMITS.loginIp.scope,
    loginIpKey,
  );

  if (!loginEmailIpLimit.allowed || !loginIpLimit.allowed) {
    return {
      formError: "Invalid email or password.",
      formSuccess: undefined,
      fieldErrors: {},
      fields,
    };
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (signInError) {
    await recordAuthRateLimitAttempt(
      supabase,
      AUTH_RATE_LIMITS.loginEmailIp,
      loginEmailIpKey,
    );
    await recordAuthRateLimitAttempt(
      supabase,
      AUTH_RATE_LIMITS.loginIp,
      loginIpKey,
    );

    return {
      formError: "Invalid email or password.",
      formSuccess: undefined,
      fieldErrors: {},
      fields,
    };
  }

  await resetAuthRateLimit(
    supabase,
    AUTH_RATE_LIMITS.loginEmailIp.scope,
    loginEmailIpKey,
  );

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
