import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminListSchema, moderationSchema } from "@/lib/admin/schemas";
import type { Database, Json } from "@/types/supabase";

type Client = SupabaseClient<Database>;
export type AdminResult =
  | { data: Json; error?: never; status?: never }
  | { data?: never; error: string; status: number };

export async function requireAdmin(supabase: Client) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user || !user.email_confirmed_at) return { error: "Unauthorized.", status: 401 } as const;
  const { data, error: roleError } = await supabase.rpc("is_admin");
  if (roleError || data !== true) return { error: "Admin access required.", status: 403 } as const;
  return { user };
}

function databaseFailure(error: { code?: string }): AdminResult {
  switch (error.code) {
    case "42501": return { error: "This moderation action is not allowed.", status: 403 };
    case "P0002": return { error: "Resource not found.", status: 404 };
    case "22023": return { error: "Invalid moderation input.", status: 400 };
    case "55000": return { error: "Resolve active work first, or hide the listing. Deleted accounts cannot be restored.", status: 409 };
    case "23503": return { error: "Related records prevent this deletion.", status: 409 };
    default: return { error: "Moderation could not be completed. Please try again.", status: 500 };
  }
}

export async function getAdminRecords(supabase: Client, input: unknown): Promise<AdminResult> {
  const actor = await requireAdmin(supabase);
  if (actor.error) return actor;
  const parsed = adminListSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid list parameters.", status: 400 };
  const { data, error } = await supabase.rpc("admin_list_records", {
    resource: parsed.data.resource, page_number: parsed.data.page, filter_value: parsed.data.filter,
  });
  return error ? databaseFailure(error) : { data };
}

export async function getAdminOverview(supabase: Client): Promise<AdminResult> {
  const actor = await requireAdmin(supabase);
  if (actor.error) return actor;
  const { data, error } = await supabase.rpc("admin_overview");
  return error ? databaseFailure(error) : { data };
}

// Called lazily, only after authenticating the administrator and validating input.
type AuthAdminFactory = () => {
  deleteUser(id: string, softDelete: boolean): Promise<{ error: { message: string } | null }>;
};

export async function moderate(supabase: Client, input: unknown, authAdminFactory?: AuthAdminFactory): Promise<AdminResult> {
  const actor = await requireAdmin(supabase);
  if (actor.error) return actor;
  const parsed = moderationSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid moderation input.", status: 400 };
  const value = parsed.data;
  if (value.targetType === "user" && value.targetId === actor.user.id) {
    return { error: "Self moderation is not allowed.", status: 403 };
  }
  let authAdmin: ReturnType<AuthAdminFactory> | undefined;
  if (value.targetType === "user" && value.decision === "delete") {
    try { authAdmin = authAdminFactory?.(); } catch { /* Do not expose environment details. */ }
    if (!authAdmin) return { error: "Account deletion is not configured.", status: 503 };
  }
  const result = value.targetType === "user"
    ? await supabase.rpc("admin_moderate_user", {
      target_user_id: value.targetId, decision: value.decision, reason: value.reason,
      suspension_end: value.suspendedUntil ?? null,
    })
    : await supabase.rpc("admin_moderate_listing", {
      target_type: value.targetType, target_id: value.targetId, decision: value.decision, reason: value.reason,
    });
  if (result.error) return databaseFailure(result.error);
  if (authAdmin) {
    // The transaction has already blocked access and anonymized the profile.
    // A failed Auth call is observable and retryable through the same command.
    const alreadyDeleted = result.data && typeof result.data === "object" && !Array.isArray(result.data) && result.data.authDeleted === true;
    if (!alreadyDeleted) {
      try {
        const { error } = await authAdmin.deleteUser(value.targetId, true);
        if (error) return { error: "Account access is blocked; Auth deletion is pending. Retry this deletion.", status: 503 };
      } catch {
        return { error: "Account access is blocked; Auth deletion is pending. Retry this deletion.", status: 503 };
      }
    }
    const confirmed = await supabase.rpc("admin_confirm_auth_deleted", { target_user_id: value.targetId });
    if (confirmed.error) return { error: "Account access is blocked; deletion confirmation is pending. Retry this deletion.", status: 503 };
  }
  return { data: result.data };
}
