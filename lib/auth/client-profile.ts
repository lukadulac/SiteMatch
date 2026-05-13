import { z } from "zod";

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function requiredText(min: number, max: number, message: string) {
  return z
    .string()
    .transform(normalizeWhitespace)
    .pipe(z.string().min(min, message).max(max));
}

function optionalText(max: number) {
  return z
    .string()
    .transform(normalizeWhitespace)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional()
    .refine((value) => value == null || value.length <= max, {
      message: `Must be ${max} characters or fewer.`,
    });
}

export const clientBusinessTypes = [
  "local_service",
  "ecommerce",
  "restaurant_hospitality",
  "health_beauty",
  "real_estate",
  "education",
  "saas_tech",
  "professional_services",
  "media_content",
  "nonprofit",
  "other",
] as const;

export const clientSolutionTypes = [
  "web_presentation",
  "business_website",
  "ecommerce_store",
  "web_application",
  "portfolio",
  "booking_platform",
  "Web_design",
  "Video_Editing",
  "Digital_Markteing",
  "other",
] as const;

export const clientBusinessTypeLabels: Record<
  (typeof clientBusinessTypes)[number],
  string
> = {
  local_service: "Local service",
  ecommerce: "E-commerce",
  restaurant_hospitality: "Restaurant / hospitality",
  health_beauty: "Health / beauty",
  real_estate: "Real estate",
  education: "Education",
  saas_tech: "SaaS / tech",
  professional_services: "Professional services",
  media_content: "Media / content",
  nonprofit: "Nonprofit",
  other: "Other",
};

export const clientSolutionTypeLabels: Record<
  (typeof clientSolutionTypes)[number],
  string
> = {
  web_presentation: "Web presentation",
  business_website: "Business website",
  ecommerce_store: "E-commerce store",
  web_application: "Web application",
  portfolio: "Portfolio",
  booking_platform: "Booking platform",
  Web_design: "Web design",
  Video_Editing: "Video editing",
  Digital_Markteing:"Digital markteing",
  other: "Other",
};

export const clientBusinessTypeSchema = z.enum(clientBusinessTypes);
export const clientSolutionTypeSchema = z.enum(clientSolutionTypes);

const pibPattern = /^[0-9]{8,12}$/;

export const clientProfileInputSchema = z
  .object({
    business_name: requiredText(2, 100, "Business name is required."),
    business_tax_id: z
      .string()
      .trim()
      .transform((value) => (value === "" ? null : value))
      .nullable()
      .optional()
      .refine((value) => value == null || pibPattern.test(value), {
        message: "PIB must contain 8 to 12 digits.",
      }),
    business_type: clientBusinessTypeSchema,
    business_type_text: optionalText(80),
    project_idea: requiredText(
      20,
      2000,
      "Project idea must be at least 20 characters long.",
    ),
    interested_solution_types: z
      .array(clientSolutionTypeSchema)
      .max(8)
      .refine((value) => value.length > 0, {
        message: "Choose at least one digital solution type.",
      }),
    interested_solution_other_text: optionalText(120),
  })
  .superRefine((value, ctx) => {
    if (value.business_type === "other" && !value.business_type_text) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["business_type_text"],
        message: "Enter your business category.",
      });
    }

    if (value.business_type !== "other" && value.business_type_text) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["business_type_text"],
        message: "Custom business category is only allowed when Other is selected.",
      });
    }

    if (
      value.interested_solution_types.includes("other") &&
      !value.interested_solution_other_text
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["interested_solution_other_text"],
        message: "Describe the other digital solution type.",
      });
    }

    if (
      !value.interested_solution_types.includes("other") &&
      value.interested_solution_other_text
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["interested_solution_other_text"],
        message: "Extra solution text is only allowed when Other is selected.",
      });
    }
  });

export type ClientProfileInput = z.infer<typeof clientProfileInputSchema>;

export function parseClientProfileForm(formData: FormData): ClientProfileInput {
  return clientProfileInputSchema.parse({
    business_name: formData.get("business_name"),
    business_tax_id: formData.get("business_tax_id"),
    business_type: formData.get("business_type"),
    business_type_text: formData.get("business_type_text"),
    project_idea: formData.get("project_idea"),
    interested_solution_types: formData.getAll("interested_solution_types"),
    interested_solution_other_text: formData.get("interested_solution_other_text"),
  });
}
