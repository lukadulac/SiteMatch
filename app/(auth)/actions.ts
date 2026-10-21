"use server";
import { isAccountEnabled } from "@/lib/auth/account-access";

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
import { getSafeReturnPath } from "@/lib/auth/return-url";
import { getDashboardPath } from "@/lib/auth/roles";
import {
  PLACE_NAME_MAX_LENGTH,
  PLACE_NAME_MIN_LENGTH,
  placeNameMessage,
  placeNamePattern,
} from "@/lib/auth/place-name";
import { getEmailConfirmationUrl } from "@/lib/auth/site-url";
import {
  MAX_REGISTRATION_AVATAR_BYTES,
  uploadRegistrationAvatar,
  validateAvatarFile,
  type ValidAvatarFile,
} from "@/lib/profiles/avatar";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long.")
  .max(72, "Password must be 72 characters or fewer.");

const personNamePattern = /^[\p{L}\p{M}][\p{L}\p{M}'’. -]*$/u;
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

const optionalPhone = z
  .string()
  .transform(normalizeWhitespace)
  .transform((value) => value === "" ? null : value)
  .superRefine((value, ctx) => {
    if (value === null) return;

    if (value.length > 20) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Phone must be 20 characters or fewer." });
    }

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

function optionalPlace(label: string) {
  return z.string().transform(normalizeWhitespace)
    .transform((value) => value === "" ? null : value)
    .superRefine((value, ctx) => {
      if (value === null) return;

      if (value.length < PLACE_NAME_MIN_LENGTH) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} must be at least ${PLACE_NAME_MIN_LENGTH} characters long.`,
        });
      } else if (value.length > PLACE_NAME_MAX_LENGTH) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} must be ${PLACE_NAME_MAX_LENGTH} characters or fewer.`,
        });
      } else if (!placeNamePattern.test(value)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: placeNameMessage(label) });
      }
    });
}

const accountSchema = z.object({
  full_name: requiredText("Full name", {
    min: 2,
    max: 80,
    pattern: personNamePattern,
    patternMessage:
      "Full name can only contain letters, spaces, apostrophes, periods, and hyphens.",
  }),
  email: z.string().trim().email("Enter a valid email address."),
  phone: optionalPhone,
  country: optionalPlace("Country"),
  city: optionalPlace("City"),
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

// A repeated sign-up for an existing unconfirmed email returns that account, so
// only an account this request just created gets the picture.
const NEW_ACCOUNT_MAX_AGE_MS = 2 * 60 * 1000;

function isNewlyCreatedAccount(user: { created_at?: string; identities?: unknown[] }) {
  const createdAt = Date.parse(user.created_at ?? "");

  return (
    // Supabase answers a sign-up for an already confirmed email with a fake user
    // that has no identities.
    Array.isArray(user.identities) &&
    user.identities.length > 0 &&
    Number.isFinite(createdAt) &&
    Date.now() - createdAt < NEW_ACCOUNT_MAX_AGE_MS
  );
}

/** Best effort: registration succeeds without the picture, which can be added later. */
async function storeRegistrationAvatar(userId: string, avatar: ValidAvatarFile) {
  try {
    const result = await uploadRegistrationAvatar(createSupabaseAdminClient(), userId, avatar);

    if (result.error) {
      console.error("Registration avatar upload failed", result.error);
    }
  } catch (error) {
    console.error("Registration avatar upload failed", error);
  }
}

const registerFieldLabels: Record<string, string> = {
  role: "I want to",
  full_name: "Full name",
  email: "Email",
  phone: "Phone",
  country: "Country",
  city: "City",
  password: "Password",
  avatar: "Profile photo",
  business_name: "Business or personal name",
  business_tax_id: "Business registration ID",
  business_type: "Business type",
  business_type_text: "Other business type",
  project_idea: "Project idea",
  interested_solution_types: "Interested solution types",
  interested_solution_other_text: "Other solution type",
  provider_type: "Provider type",
  tax_id: "Business registration ID",
  years_of_experience: "Years of experience",
  portfolio_url: "Portfolio URL",
  social_link: "Social link",
  service_categories: "Service categories",
  service_category_other_text: "Other service category",
  about: "About",
};

/** Names the fields, since the message sits below a long form. */
function describeInvalidFields(
  fieldErrors: Record<string, string[] | undefined>,
) {
  const labels = Object.keys(fieldErrors)
    .filter((key) => fieldErrors[key]?.length)
    .map((key) => registerFieldLabels[key] ?? key);

  return labels.length > 0
    ? `Please fix the highlighted fields: ${[...new Set(labels)].join(", ")}.`
    : "Please fix the highlighted fields.";
}

function validationError(
  fields: Record<string, string>,
  fieldErrors: Record<string, string[] | undefined>,
): AuthActionState {
  return {
    formError: describeInvalidFields(fieldErrors),
    formSuccess: undefined,
    fieldErrors,
    fields,
  };
}

function formatWait(seconds: number) {
  const minutes = Math.ceil(seconds / 60);

  return minutes <= 1 ? "a minute" : `${minutes} minutes`;
}

/**
 * Says what the user can do about a failed sign-up. "Already registered" stays
 * generic so the form cannot be used to test which emails have accounts.
 */
function getSignUpErrorMessage(code: string | undefined) {
  switch (code) {
    case "over_email_send_rate_limit":
      return "We can't send confirmation emails right now. Please try again in a little while.";
    case "over_request_rate_limit":
      return "Too many sign-up attempts. Please wait a few minutes and try again.";
    case "weak_password":
      return "Choose a stronger password.";
    case "email_address_invalid":
      return "This email address can't be used. Try another one.";
    case "signup_disabled":
    case "email_provider_disabled":
      return "New sign-ups are turned off right now.";
    default:
      return "We could not create your account. Please try again.";
  }
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

  const avatarEntry = formData.get("avatar");
  let avatar: ValidAvatarFile | null = null;

  if (avatarEntry instanceof Blob && avatarEntry.size > 0) {
    const validAvatar = await validateAvatarFile(avatarEntry, MAX_REGISTRATION_AVATAR_BYTES);

    if ("error" in validAvatar) {
      return validationError(fields, { avatar: [validAvatar.error] });
    }

    avatar = validAvatar;
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
    // retryAfterSeconds is 0 when the limiter itself failed (already logged).
    if (registerLimit.retryAfterSeconds > 0) {
      console.warn("Registration blocked by the per-IP rate limit", {
        retryAfterSeconds: registerLimit.retryAfterSeconds,
      });
    }

    return {
      formError:
        registerLimit.retryAfterSeconds > 0
          ? `Too many sign-up attempts from your network. Try again in ${formatWait(registerLimit.retryAfterSeconds)}.`
          : "We could not create your account. Please try again.",
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
        emailRedirectTo: getEmailConfirmationUrl(getStringValue(formData, "next")),
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
      console.error("Registration sign-up failed", {
        code: signUpError?.code,
        status: signUpError?.status,
        message: signUpError?.message ?? "No user returned",
      });

      return {
        formError: getSignUpErrorMessage(signUpError?.code),
        formSuccess: undefined,
        fieldErrors: {},
        fields,
      };
    }

    if (avatar && isNewlyCreatedAccount(authData.user)) {
      await storeRegistrationAvatar(authData.user.id, avatar);
    }

    if (!authData.session) {
      return {
        formError: undefined,
        formSuccess:
          "Check your inbox to confirm your email, then sign in.",
        verificationRequired: true,
        resendAfter: Date.now() + 60_000,
        fieldErrors: {},
        fields: {
          email: parsed.data.email,
        },
      };
    }

    if (!authData.user.email_confirmed_at) {
      await supabase.auth.signOut({ scope: "local" });
      return {
        verificationRequired: true,
        formError: "Confirm your email before signing in.",
        fieldErrors: {},
        fields: { email: parsed.data.email },
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
  const safeNext = getSafeReturnPath(getStringValue(formData, "next"));
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
  const [loginEmailIpLimit, loginIpLimit] = await Promise.all([
    checkAuthRateLimit(
      supabase,
      AUTH_RATE_LIMITS.loginEmailIp.scope,
      loginEmailIpKey,
    ),
    checkAuthRateLimit(
      supabase,
      AUTH_RATE_LIMITS.loginIp.scope,
      loginIpKey,
    ),
  ]);

  if (!loginEmailIpLimit.allowed || !loginIpLimit.allowed) {
    return {
      formError: "Invalid email or password.",
      formSuccess: undefined,
      fieldErrors: {},
      fields,
    };
  }

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
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

  const user = signInData.user;
  if (!user || !signInData.session) {
    return {
      formError: "Your session could not be established. Please try again.",
      formSuccess: undefined,
      fieldErrors: {},
      fields,
    };
  }

  if (!user.email_confirmed_at) {
    await supabase.auth.signOut({ scope: "local" });
    return {
      formError: "Confirm your email before signing in.",
      verificationRequired: true,
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

  if (!(await isAccountEnabled(supabase, user.id))) {
    await supabase.auth.signOut({ scope: "local" });
    return { formError: "Your account is currently unavailable.", fieldErrors: {}, fields };
  }

  if (safeNext) {
    redirect(safeNext);
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
