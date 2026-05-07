"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { DashboardActionState } from "@/app/dashboard/action-state";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

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

function optionalText(
  label: string,
  {
    min,
    max,
    pattern,
    patternMessage,
  }: {
    min?: number;
    max: number;
    pattern?: RegExp;
    patternMessage?: string;
  },
) {
  return z
    .string()
    .transform(normalizeWhitespace)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .superRefine((value, ctx) => {
      if (value == null) {
        return;
      }

      if (min != null && value.length < min) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} must be at least ${min} characters long.`,
        });
      }

      if (value.length > max) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} must be ${max} characters or fewer.`,
        });
      }

      if (pattern && !pattern.test(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: patternMessage ?? `${label} contains invalid characters.`,
        });
      }
    });
}

const optionalUrl = z
  .string()
  .transform(normalizeWhitespace)
  .transform((value, ctx) => {
    if (value === "") {
      return null;
    }

    try {
      const url = new URL(value);

      if (url.protocol !== "http:" && url.protocol !== "https:") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "URL must start with http:// or https://.",
        });
        return z.NEVER;
      }

      return url.toString();
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid URL.",
      });
      return z.NEVER;
    }
  })
  .nullable();

const optionalNonNegativeNumber = z
  .string()
  .transform(normalizeWhitespace)
  .transform((value, ctx) => {
    if (value === "") {
      return null;
    }

    const parsed = Number(value);

    if (Number.isNaN(parsed) || parsed < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a number greater than or equal to 0.",
      });
      return z.NEVER;
    }

    return parsed;
  })
  .nullable();

const optionalInteger = z
  .string()
  .transform(normalizeWhitespace)
  .transform((value, ctx) => {
    if (value === "") {
      return null;
    }

    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a whole number greater than or equal to 0.",
      });
      return z.NEVER;
    }

    return parsed;
  })
  .nullable();

const personNamePattern = /^[\p{L}\p{M}][\p{L}\p{M}'’. -]*$/u;
const placeNamePattern = /^[\p{L}\p{M}][\p{L}\p{M}'’. -]*$/u;
const businessNamePattern = /^[\p{L}\p{M}\d&'",./()\- ]+$/u;
const businessTypePattern = /^[\p{L}\p{M}\d&'",/()\- ]+$/u;
const companySizePattern = /^[\p{L}\p{M}\d+,/()\- ]+$/u;
const phonePattern = /^\+?[0-9().\-\s]{7,20}$/;

const profileSchema = z.object({
  full_name: requiredText("Full name", {
    min: 2,
    max: 80,
    pattern: personNamePattern,
    patternMessage:
      "Full name can only contain letters, spaces, apostrophes, periods, and hyphens.",
  }),
  phone: optionalText("Phone", {
    max: 20,
    pattern: phonePattern,
    patternMessage:
      "Phone can only contain numbers, spaces, parentheses, dots, hyphens, and an optional leading +.",
  }).superRefine((value, ctx) => {
    if (value == null) {
      return;
    }

    const digitCount = value.replace(/\D/g, "").length;

    if (digitCount < 7 || digitCount > 15) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Phone must contain between 7 and 15 digits.",
      });
    }
  }),
  country: optionalText("Country", {
    min: 2,
    max: 56,
    pattern: placeNamePattern,
    patternMessage:
      "Country can only contain letters, spaces, apostrophes, periods, and hyphens.",
  }),
  city: optionalText("City", {
    min: 2,
    max: 56,
    pattern: placeNamePattern,
    patternMessage:
      "City can only contain letters, spaces, apostrophes, periods, and hyphens.",
  }),
});

const clientProfileSchema = profileSchema.extend({
  business_name: requiredText("Business name", {
    min: 2,
    max: 100,
    pattern: businessNamePattern,
    patternMessage:
      "Business name can only contain letters, numbers, spaces, and common business punctuation.",
  }),
  business_type: requiredText("Business type", {
    min: 2,
    max: 60,
    pattern: businessTypePattern,
    patternMessage:
      "Business type can only contain letters, numbers, spaces, and common punctuation.",
  }),
  business_description: requiredText("Business description", {
    min: 30,
    max: 1200,
  }),
  website_url: optionalUrl,
  company_size: optionalText("Company size", {
    min: 1,
    max: 40,
    pattern: companySizePattern,
    patternMessage:
      "Company size can only contain letters, numbers, spaces, plus signs, commas, slashes, and hyphens.",
  }),
  preferred_language: requiredText("Preferred language", {
    min: 2,
    max: 40,
    pattern: placeNamePattern,
    patternMessage:
      "Preferred language can only contain letters, spaces, apostrophes, periods, and hyphens.",
  }),
});

const providerProfileSchema = profileSchema
  .extend({
    provider_type: z.enum(["freelancer", "agency", "studio"]),
    headline: optionalText("Headline", {
      min: 3,
      max: 120,
    }),
    bio: optionalText("Bio", {
      min: 20,
      max: 2000,
    }),
    years_of_experience: optionalInteger,
    portfolio_url: optionalUrl,
    hourly_rate_min: optionalNonNegativeNumber,
    hourly_rate_max: optionalNonNegativeNumber,
    fixed_price_min: optionalNonNegativeNumber,
    fixed_price_max: optionalNonNegativeNumber,
    availability: z.enum(["available", "busy", "unavailable"]),
  })
  .superRefine((data, ctx) => {
    if (
      data.hourly_rate_min != null &&
      data.hourly_rate_max != null &&
      data.hourly_rate_min > data.hourly_rate_max
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["hourly_rate_max"],
        message: "Max hourly rate must be greater than or equal to min.",
      });
    }

    if (
      data.fixed_price_min != null &&
      data.fixed_price_max != null &&
      data.fixed_price_min > data.fixed_price_max
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fixed_price_max"],
        message: "Max fixed price must be greater than or equal to min.",
      });
    }
  });

const adminProfileSchema = profileSchema;

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

async function getAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null };
  }

  return { supabase, user };
}

export async function updateClientProfileAction(
  _previousState: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  const parsed = clientProfileSchema.safeParse({
    full_name: getFormValue(formData, "full_name"),
    phone: getFormValue(formData, "phone"),
    country: getFormValue(formData, "country"),
    city: getFormValue(formData, "city"),
    business_name: getFormValue(formData, "business_name"),
    business_type: getFormValue(formData, "business_type"),
    business_description: getFormValue(formData, "business_description"),
    website_url: getFormValue(formData, "website_url"),
    company_size: getFormValue(formData, "company_size"),
    preferred_language: getFormValue(formData, "preferred_language"),
  });

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors);
  }

  const { supabase, user } = await getAuthenticatedUser();

  if (!user) {
    return {
      formError: "You must be signed in to update your profile.",
      formSuccess: undefined,
      fieldErrors: {},
    };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      phone: parsed.data.phone,
      country: parsed.data.country,
      city: parsed.data.city,
    })
    .eq("id", user.id);

  if (profileError) {
    return {
      formError: profileError.message,
      formSuccess: undefined,
      fieldErrors: {},
    };
  }

  const { error: clientProfileError } = await supabase
    .from("client_profiles")
    .upsert(
      {
        user_id: user.id,
        business_name: parsed.data.business_name,
        business_type: parsed.data.business_type,
        business_description: parsed.data.business_description,
        website_url: parsed.data.website_url,
        company_size: parsed.data.company_size,
        preferred_language: parsed.data.preferred_language,
      },
      { onConflict: "user_id" },
    );

  if (clientProfileError) {
    return {
      formError: clientProfileError.message,
      formSuccess: undefined,
      fieldErrors: {},
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/client");

  return {
    formError: undefined,
    formSuccess: "Your client profile was updated.",
    fieldErrors: {},
  };
}

export async function updateProviderProfileAction(
  _previousState: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  const parsed = providerProfileSchema.safeParse({
    full_name: getFormValue(formData, "full_name"),
    phone: getFormValue(formData, "phone"),
    country: getFormValue(formData, "country"),
    city: getFormValue(formData, "city"),
    provider_type: getFormValue(formData, "provider_type"),
    headline: getFormValue(formData, "headline"),
    bio: getFormValue(formData, "bio"),
    years_of_experience: getFormValue(formData, "years_of_experience"),
    portfolio_url: getFormValue(formData, "portfolio_url"),
    hourly_rate_min: getFormValue(formData, "hourly_rate_min"),
    hourly_rate_max: getFormValue(formData, "hourly_rate_max"),
    fixed_price_min: getFormValue(formData, "fixed_price_min"),
    fixed_price_max: getFormValue(formData, "fixed_price_max"),
    availability: getFormValue(formData, "availability"),
  });

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors);
  }

  const { supabase, user } = await getAuthenticatedUser();

  if (!user) {
    return {
      formError: "You must be signed in to update your profile.",
      formSuccess: undefined,
      fieldErrors: {},
    };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      phone: parsed.data.phone,
      country: parsed.data.country,
      city: parsed.data.city,
    })
    .eq("id", user.id);

  if (profileError) {
    return {
      formError: profileError.message,
      formSuccess: undefined,
      fieldErrors: {},
    };
  }

  const providerProfilePayload: Database["public"]["Tables"]["provider_profiles"]["Insert"] =
    {
      user_id: user.id,
      provider_type: parsed.data.provider_type,
      headline: parsed.data.headline,
      bio: parsed.data.bio,
      years_of_experience: parsed.data.years_of_experience,
      portfolio_url: parsed.data.portfolio_url,
      hourly_rate_min: parsed.data.hourly_rate_min,
      hourly_rate_max: parsed.data.hourly_rate_max,
      fixed_price_min: parsed.data.fixed_price_min,
      fixed_price_max: parsed.data.fixed_price_max,
      availability: parsed.data.availability,
    };

  const { error: providerProfileError } = await supabase
    .from("provider_profiles")
    .upsert(providerProfilePayload, { onConflict: "user_id" });

  if (providerProfileError) {
    return {
      formError: providerProfileError.message,
      formSuccess: undefined,
      fieldErrors: {},
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/provider");

  return {
    formError: undefined,
    formSuccess: "Your provider profile was updated.",
    fieldErrors: {},
  };
}

export async function updateAdminProfileAction(
  _previousState: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  const parsed = adminProfileSchema.safeParse({
    full_name: getFormValue(formData, "full_name"),
    phone: getFormValue(formData, "phone"),
    country: getFormValue(formData, "country"),
    city: getFormValue(formData, "city"),
  });

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors);
  }

  const { supabase, user } = await getAuthenticatedUser();

  if (!user) {
    return {
      formError: "You must be signed in to update your profile.",
      formSuccess: undefined,
      fieldErrors: {},
    };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      phone: parsed.data.phone,
      country: parsed.data.country,
      city: parsed.data.city,
    })
    .eq("id", user.id);

  if (error) {
    return {
      formError: error.message,
      formSuccess: undefined,
      fieldErrors: {},
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/admin");

  return {
    formError: undefined,
    formSuccess: "Your admin profile was updated.",
    fieldErrors: {},
  };
}
