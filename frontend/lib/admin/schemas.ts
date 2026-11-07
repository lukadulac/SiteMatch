import { z } from "zod";

const reason = z.string().trim().min(10).max(2000);
const id = z.uuid();

export const moderationSchema = z.discriminatedUnion("targetType", [
  z.object({
    targetType: z.literal("user"),
    targetId: id,
    decision: z.enum(["suspend", "ban", "reactivate", "delete"]),
    reason,
    suspendedUntil: z.iso.datetime({ offset: true }).optional(),
  }).strict().superRefine((value, ctx) => {
    if (value.decision === "suspend") {
      if (!value.suspendedUntil || Date.parse(value.suspendedUntil) <= Date.now()) {
        ctx.addIssue({ code: "custom", path: ["suspendedUntil"], message: "Choose a future suspension end." });
      }
    } else if (value.suspendedUntil !== undefined) {
      ctx.addIssue({ code: "custom", path: ["suspendedUntil"], message: "Only suspensions have an end date." });
    }
  }),
  z.object({
    targetType: z.enum(["project", "service"]),
    targetId: id,
    decision: z.enum(["hide", "restore", "delete"]),
    reason,
  }).strict(),
]);

export const adminListSchema = z.object({
  resource: z.enum(["users", "projects", "services", "audit"]),
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  filter: z.enum(["all", "hidden", "visible", "active", "suspended", "banned", "deleted"]).default("all"),
}).strict().superRefine((value, ctx) => {
  const allowed = value.resource === "users"
    ? ["all", "active", "suspended", "banned", "deleted"]
    : value.resource === "audit" ? ["all"] : ["all", "hidden", "visible"];
  if (!allowed.includes(value.filter)) {
    ctx.addIssue({ code: "custom", path: ["filter"], message: "Invalid filter for this resource." });
  }
});

export type ModerationInput = z.infer<typeof moderationSchema>;
