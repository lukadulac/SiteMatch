import { z } from "zod";

export const adminResources = ["users", "projects", "services", "audit"] as const;
export type AdminResource = (typeof adminResources)[number];

const allowedFilters = {
  users: ["all", "active", "suspended", "banned", "deleted"],
  projects: ["all", "visible", "hidden"],
  services: ["all", "visible", "hidden"],
  audit: ["all"],
} as const;

export function isAdminResource(value: string): value is AdminResource {
  return adminResources.some((resource) => resource === value);
}

export function adminFilters(resource: AdminResource): readonly string[] {
  return allowedFilters[resource];
}

export function parseAdminListParams(
  resource: AdminResource,
  raw: { filter?: string | string[]; page?: string | string[] },
) {
  const filter = typeof raw.filter === "string" && adminFilters(resource).includes(raw.filter)
    ? raw.filter : "all";
  const validPage = typeof raw.page === "string" && /^[1-9]\d*$/.test(raw.page)
    && Number(raw.page) <= 1_000_000;
  const page = validPage ? Number(raw.page) : 1;
  const normalized = (raw.filter !== undefined && raw.filter !== filter)
    || (raw.page !== undefined && (!validPage || raw.page !== String(page)));
  return { filter, page, normalized };
}

export function adminListUrl(resource: AdminResource, filter = "all", page = 1) {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("filter", filter);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/dashboard/admin/${resource}${query ? `?${query}` : ""}`;
}

export const adminOverviewSchema = z.object({
  users: z.number().int().nonnegative(),
  projects: z.number().int().nonnegative(),
  services: z.number().int().nonnegative(),
  hiddenProjects: z.number().int().nonnegative(),
  hiddenServices: z.number().int().nonnegative(),
  pendingAuthDeletions: z.number().int().nonnegative(),
});

const baseRow = z.object({ id: z.uuid(), created_at: z.string() });

export const adminRowSchemas = {
  users: baseRow.extend({
    full_name: z.string(), email: z.string(), role: z.string(),
    moderation_status: z.string(), access_enabled: z.boolean(),
    suspended_until: z.string().nullable(), auth_deleted_at: z.string().nullable(),
  }),
  projects: baseRow.extend({
    client_id: z.uuid(), title: z.string(), status: z.string(), is_hidden: z.boolean(),
  }),
  services: baseRow.extend({
    provider_id: z.uuid(), title: z.string(), status: z.string(), is_hidden: z.boolean(),
  }),
  audit: baseRow.extend({
    actor_id: z.uuid(), owner_id: z.uuid(), target_type: z.string(),
    target_id: z.uuid(), action: z.string(), reason: z.string(),
  }),
};

function listSchema<T extends z.ZodType>(row: T) {
  return z.object({
    items: z.array(row),
    totalCount: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
  });
}

export const adminListSchemas = {
  users: listSchema(adminRowSchemas.users),
  projects: listSchema(adminRowSchemas.projects),
  services: listSchema(adminRowSchemas.services),
  audit: listSchema(adminRowSchemas.audit),
};

export function parseAdminListResponse(resource: AdminResource, value: unknown) {
  return adminListSchemas[resource].parse(value);
}

export type ModerationTarget = "user" | "project" | "service";
export type ModerationDecision = "hide" | "restore" | "suspend" | "ban" | "reactivate" | "delete";

export function moderationChoices(target: ModerationTarget, status: string, retryDeletion = false): ModerationDecision[] {
  if (target !== "user") return status === "hidden" ? ["restore", "delete"] : ["hide", "delete"];
  if (status === "deleted") return retryDeletion ? ["delete"] : [];
  if (status === "banned") return ["reactivate", "delete"];
  if (status === "suspended") return ["reactivate", "ban", "delete"];
  return ["suspend", "ban", "delete"];
}
