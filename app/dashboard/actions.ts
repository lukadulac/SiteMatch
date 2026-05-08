"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { DashboardActionState } from "@/app/dashboard/action-state";
import { clientProfileInputSchema } from "@/lib/auth/client-profile";
import { providerProfileInputSchema } from "@/lib/auth/provider-profile";
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

const clientProfileSchema = profileSchema
  .extend({
    website_url: optionalUrl,
    company_size: optionalText("Company size", {
      min: 1,
      max: 40,
      pattern: companySizePattern,
      patternMessage:
        "Company size can only contain letters, numbers, spaces, plus signs, commas, slashes, and hyphens.",
    }),
  })
  .and(clientProfileInputSchema);

const providerProfileSchema = profileSchema
  .and(providerProfileInputSchema)
  .superRefine((data, ctx) => {
    if (!data.phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: "Phone is required.",
      });
    }

    if (!data.country) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["country"],
        message: "Country is required.",
      });
    }

    if (!data.city) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["city"],
        message: "City is required.",
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
    business_tax_id: getFormValue(formData, "business_tax_id"),
    business_type: getFormValue(formData, "business_type"),
    business_type_text: getFormValue(formData, "business_type_text"),
    project_idea: getFormValue(formData, "project_idea"),
    interested_solution_types: formData.getAll("interested_solution_types"),
    interested_solution_other_text: getFormValue(
      formData,
      "interested_solution_other_text",
    ),
    website_url: getFormValue(formData, "website_url"),
    company_size: getFormValue(formData, "company_size"),
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
        business_tax_id: parsed.data.business_tax_id,
        business_type: parsed.data.business_type,
        business_type_text: parsed.data.business_type_text,
        project_idea: parsed.data.project_idea,
        interested_solution_types: parsed.data.interested_solution_types,
        interested_solution_other_text: parsed.data.interested_solution_other_text,
        website_url: parsed.data.website_url,
        company_size: parsed.data.company_size,
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
    tax_id: getFormValue(formData, "tax_id"),
    years_of_experience: getFormValue(formData, "years_of_experience"),
    portfolio_url: getFormValue(formData, "portfolio_url"),
    social_link: getFormValue(formData, "social_link"),
    service_categories: formData.getAll("service_categories"),
    service_category_other_text: getFormValue(
      formData,
      "service_category_other_text",
    ),
    about: getFormValue(formData, "about"),
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
      tax_id: parsed.data.tax_id,
      years_of_experience: parsed.data.years_of_experience,
      portfolio_url: parsed.data.portfolio_url,
      social_link: parsed.data.social_link,
      service_categories: parsed.data.service_categories,
      service_category_other_text: parsed.data.service_category_other_text,
      about: parsed.data.about,
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
