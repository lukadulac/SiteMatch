import { z } from "zod";

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

const optionalText = (max: number) =>
  z
    .string()
    .transform(normalizeWhitespace)
    .transform((value, ctx) => {
      if (value.length > max) {
        ctx.addIssue({
          code: z.ZodIssueCode.too_big,
          maximum: max,
          inclusive: true,
          origin: "string",
          message: `Must be ${max} characters or fewer.`,
        });
        return z.NEVER;
      }

      return value === "" ? null : value;
    })
    .nullable()
    .optional();

const requiredText = (min: number, max: number) =>
  z
    .string()
    .transform(normalizeWhitespace)
    .pipe(z.string().min(min).max(max));

const optionalUrl = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional()
  .refine((value) => {
    if (value == null) {
      return true;
    }

    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }, "Enter a valid URL.");

const optionalMoney = z
  .number()
  .finite()
  .min(0)
  .nullable()
  .optional();

const uuidArray = z.array(z.uuid()).max(10).default([]);

export const createProjectSchema = z
  .object({
    title: requiredText(6, 120),
    description: requiredText(40, 3000),
    service_type_id: z.uuid(),
    business_domain_id: z.uuid().nullable().optional(),
    business_domain_other_text: optionalText(120),
    business_context_text: optionalText(1200),
    what_do_you_need_text: requiredText(20, 1200),
    target_audience_text: optionalText(600),
    success_criteria_text: optionalText(600),
    goal_other_text: optionalText(160),
    goal_ids: uuidArray,
    feature_ids: uuidArray,
    budget_type: z.enum(["fixed", "range", "negotiable"]).default("range"),
    budget_min: optionalMoney,
    budget_max: optionalMoney,
    deadline_type: z.enum(["specific_date", "flexible", "asap"]).default("flexible"),
    deadline_date: z.iso.date().nullable().optional(),
    desired_start_date: z.iso.date().nullable().optional(),
    readiness_level: z
      .enum([
        "idea_only",
        "need_guidance",
        "content_ready",
        "design_ready",
        "spec_ready",
      ])
      .nullable()
      .optional(),
    scope_level: z.enum(["small", "medium", "large"]).nullable().optional(),
    estimated_pages: z.number().int().positive().max(500).nullable().optional(),
    has_existing_website: z.boolean().default(false),
    existing_website_url: optionalUrl,
    needs_design: z.boolean().default(false),
    needs_seo: z.boolean().default(false),
    needs_content_writing: z.boolean().default(false),
    is_remote_friendly: z.boolean().default(true),
    preferred_language: optionalText(40),
    preferred_provider_type: z
      .enum(["freelancer", "agency", "studio", "any"])
      .default("any"),
    discovery_notes: optionalText(1200),
    status: z.enum(["draft", "published"]).default("draft"),
  })
  .superRefine((value, ctx) => {
    if (!value.business_domain_id && !value.business_domain_other_text) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["business_domain_other_text"],
        message: "Choose a business domain or enter a custom one.",
      });
    }

    if (value.budget_type !== "negotiable" && value.budget_min == null && value.budget_max == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["budget_min"],
        message: "Enter at least one budget value or choose negotiable.",
      });
    }

    if (
      value.budget_min != null &&
      value.budget_max != null &&
      value.budget_min > value.budget_max
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["budget_max"],
        message: "Maximum budget must be greater than or equal to minimum budget.",
      });
    }

    if (value.deadline_type === "specific_date" && !value.deadline_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["deadline_date"],
        message: "Choose a deadline date.",
      });
    }

    if (value.has_existing_website && !value.existing_website_url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["existing_website_url"],
        message: "Enter the existing website URL.",
      });
    }
  });

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
