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
  "construction_renovation",
  "home_services",
  "design_creative",
  "tech_it",
  "marketing_sales",
  "writing_translation",
  "finance_accounting",
  "legal",
  "business_consulting",
  "education_tutoring",
  "health_wellness",
  "beauty_personal_care",
  "events_hospitality",
  "photo_video",
  "transport_logistics",
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
  construction_renovation: "Construction & renovation",
  home_services: "Home services & repairs",
  design_creative: "Design & creative",
  tech_it: "Tech & IT",
  marketing_sales: "Marketing & sales",
  writing_translation: "Writing & translation",
  finance_accounting: "Finance & accounting",
  legal: "Legal",
  business_consulting: "Business consulting",
  education_tutoring: "Education & tutoring",
  health_wellness: "Health & wellness",
  beauty_personal_care: "Beauty & personal care",
  events_hospitality: "Events & hospitality",
  photo_video: "Photo & video",
  transport_logistics: "Transport & logistics",
  other: "Other",
};

export const clientBusinessTypeSchema = z.enum(clientBusinessTypes);
export const clientSolutionTypeSchema = z.enum(clientSolutionTypes);

export const clientProfileInputSchema = z
  .object({
    business_name: requiredText(2, 100, "Business name is required."),
    business_tax_id: optionalText(60),
    business_type: z.preprocess(
      (value) => value === "" ? null : value,
      clientBusinessTypeSchema.nullable().optional(),
    ),
    business_type_text: optionalText(80),
    project_idea: optionalText(2000).refine(
      (value) => value == null || value.length >= 20,
      { message: "Project idea must be at least 20 characters long." },
    ),
    interested_solution_types: z
      .array(clientSolutionTypeSchema)
      .max(clientSolutionTypes.length, "Choose each service only once."),
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
        message: "Describe the other service you need.",
      });
    }

    if (
      !value.interested_solution_types.includes("other") &&
      value.interested_solution_other_text
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["interested_solution_other_text"],
        message: "Extra service text is only allowed when Other is selected.",
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
