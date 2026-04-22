"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { DashboardActionState } from "@/app/dashboard/action-state";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable();

const optionalUrl = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value === "") {
      return null;
    }

    try {
      new URL(value);
      return value;
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
  .trim()
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
  .trim()
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

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Full name is required."),
  phone: optionalText,
  country: optionalText,
  city: optionalText,
  avatar_url: optionalUrl,
});

const clientProfileSchema = profileSchema.extend({
  business_name: z.string().trim().min(2, "Business name is required."),
  business_type: optionalText,
  business_description: optionalText,
  website_url: optionalUrl,
  company_size: optionalText,
  preferred_language: optionalText,
});

const providerProfileSchema = profileSchema
  .extend({
    provider_type: z.enum(["freelancer", "agency", "studio"]),
    headline: optionalText,
    bio: optionalText,
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
    avatar_url: getFormValue(formData, "avatar_url"),
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
      avatar_url: parsed.data.avatar_url,
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
    avatar_url: getFormValue(formData, "avatar_url"),
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
      avatar_url: parsed.data.avatar_url,
    })
    .eq("id", user.id);

  if (profileError) {
    return {
      formError: profileError.message,
      formSuccess: undefined,
      fieldErrors: {},
    };
  }

  const { error: providerProfileError } = await supabase
    .from("provider_profiles")
    .upsert(
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
      },
      { onConflict: "user_id" },
    );

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
    avatar_url: getFormValue(formData, "avatar_url"),
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
      avatar_url: parsed.data.avatar_url,
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
